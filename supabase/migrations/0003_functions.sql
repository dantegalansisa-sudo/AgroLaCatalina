-- =============================================================
-- Lógica de negocio (funciones RPC, SECURITY DEFINER)
-- =============================================================

-- ---------- Registro automático de cambios de stock directos ----------
create or replace function public.log_stock_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.stock_ctx', true), '') <> '' then
    return new; -- la función que modificó el stock ya registró el movimiento
  end if;
  if tg_op = 'INSERT' then
    if new.stock <> 0 then
      insert into inventory_movements (product_id, type, quantity, stock_after, reason, user_id)
      values (new.id, 'inicial', new.stock, new.stock, 'Stock inicial', auth.uid());
    end if;
  elsif new.stock is distinct from old.stock then
    insert into inventory_movements (product_id, type, quantity, stock_after, reason, user_id)
    values (new.id, 'ajuste', new.stock - old.stock, new.stock, 'Edición directa del producto', auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists products_stock_log on public.products;
create trigger products_stock_log after insert or update of stock on public.products
  for each row execute function public.log_stock_change();

-- ---------- Caja ----------
create or replace function public.current_cash_session() returns public.cash_sessions
language sql stable security definer set search_path = public as $$
  select * from cash_sessions where user_id = auth.uid() and closed_at is null limit 1
$$;

create or replace function public.open_cash_session(p_opening numeric, p_notes text default null)
returns public.cash_sessions
language plpgsql security definer set search_path = public as $$
declare s cash_sessions;
begin
  if not is_active_user() then raise exception 'Usuario no autorizado'; end if;
  if exists (select 1 from cash_sessions where user_id = auth.uid() and closed_at is null) then
    raise exception 'Ya tienes una caja abierta';
  end if;
  insert into cash_sessions (user_id, opening_amount, notes)
  values (auth.uid(), greatest(coalesce(p_opening, 0), 0), p_notes)
  returning * into s;
  return s;
end $$;

create or replace function public.cash_session_summary(p_session uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s cash_sessions;
  v_cash numeric; v_transfer numeric; v_credit numeric;
  v_ab_cash numeric; v_ab_transfer numeric;
  v_count int; v_total numeric; v_voided int;
begin
  select * into s from cash_sessions where id = p_session;
  if s.id is null then raise exception 'Caja no encontrada'; end if;
  if not (is_admin() or s.user_id = auth.uid()) then raise exception 'No autorizado'; end if;

  select
    coalesce(sum(p.amount) filter (where p.method = 'efectivo'), 0),
    coalesce(sum(p.amount) filter (where p.method = 'transferencia'), 0),
    coalesce(sum(p.amount) filter (where p.method = 'fiado'), 0)
  into v_cash, v_transfer, v_credit
  from sale_payments p join sales sa on sa.id = p.sale_id
  where sa.cash_session_id = s.id and sa.status = 'completada';

  select count(*) filter (where status = 'completada'),
         coalesce(sum(total) filter (where status = 'completada'), 0),
         count(*) filter (where status = 'anulada')
  into v_count, v_total, v_voided
  from sales where cash_session_id = s.id;

  select coalesce(sum(amount) filter (where method = 'efectivo'), 0),
         coalesce(sum(amount) filter (where method = 'transferencia'), 0)
  into v_ab_cash, v_ab_transfer
  from customer_payments where cash_session_id = s.id;

  return jsonb_build_object(
    'opening_amount', s.opening_amount,
    'sales_count', v_count,
    'sales_total', v_total,
    'voided_count', v_voided,
    'cash_sales', v_cash,
    'transfer_sales', v_transfer,
    'credit_sales', v_credit,
    'cash_payments', v_ab_cash,
    'transfer_payments', v_ab_transfer,
    'expected_cash', s.opening_amount + v_cash + v_ab_cash
  );
end $$;

create or replace function public.close_cash_session(p_session uuid, p_counted numeric, p_notes text default null)
returns public.cash_sessions
language plpgsql security definer set search_path = public as $$
declare s cash_sessions; v_sum jsonb; v_expected numeric;
begin
  select * into s from cash_sessions where id = p_session for update;
  if s.id is null then raise exception 'Caja no encontrada'; end if;
  if s.closed_at is not null then raise exception 'Esta caja ya está cerrada'; end if;
  if not (is_admin() or (s.user_id = auth.uid() and is_active_user())) then raise exception 'No autorizado'; end if;
  v_sum := cash_session_summary(p_session);
  v_expected := (v_sum ->> 'expected_cash')::numeric;
  update cash_sessions set
    closed_at = now(),
    expected_cash = v_expected,
    counted_cash = coalesce(p_counted, 0),
    difference = coalesce(p_counted, 0) - v_expected,
    summary = v_sum,
    notes = coalesce(nullif(p_notes, ''), notes)
  where id = p_session
  returning * into s;
  return s;
end $$;

-- ---------- Crear venta ----------
-- p jsonb: { customer_id, note, global_discount,
--            items: [{product_id, quantity, discount}],
--            payments: [{method, amount, reference}] }
create or replace function public.create_sale(p jsonb) returns public.sales
language plpgsql security definer set search_path = public as $$
declare
  v_session cash_sessions;
  v_sale sales;
  v_settings business_settings;
  it jsonb; pay jsonb;
  pr products;
  v_qty numeric; v_disc numeric; v_gross numeric;
  v_subtotal numeric := 0; v_line_disc numeric := 0; v_global numeric; v_total numeric;
  v_cash_given numeric := 0; v_transfer numeric := 0; v_credit numeric := 0; v_cash_applied numeric;
  v_customer uuid := nullif(p ->> 'customer_id', '')::uuid;
  v_item_id uuid;
  v_ref text;
begin
  if not is_active_user() then raise exception 'Usuario no autorizado'; end if;
  select * into v_session from cash_sessions where user_id = auth.uid() and closed_at is null;
  if v_session.id is null then raise exception 'Debes abrir la caja antes de vender'; end if;
  if jsonb_array_length(coalesce(p -> 'items', '[]'::jsonb)) = 0 then raise exception 'El carrito está vacío'; end if;
  select * into v_settings from business_settings where id = 1;

  perform set_config('app.stock_ctx', 'sale', true);

  insert into sales (user_id, customer_id, cash_session_id, note)
  values (auth.uid(), v_customer, v_session.id, nullif(trim(p ->> 'note'), ''))
  returning * into v_sale;

  for it in select * from jsonb_array_elements(p -> 'items') loop
    select * into pr from products where id = (it ->> 'product_id')::uuid for update;
    if pr.id is null then raise exception 'Producto no encontrado'; end if;
    if not pr.active then raise exception 'El producto % está inactivo', pr.name; end if;
    if pr.price <= 0 then raise exception 'El producto % no tiene precio asignado', pr.name; end if;
    v_qty := round(coalesce((it ->> 'quantity')::numeric, 0), 2);
    if v_qty <= 0 then raise exception 'Cantidad inválida para %', pr.name; end if;
    if not coalesce(v_settings.allow_negative_stock, false) and pr.stock < v_qty then
      raise exception 'Stock insuficiente de % (disponible: %)', pr.name, pr.stock;
    end if;
    v_gross := round(pr.price * v_qty, 2);
    v_disc := least(greatest(round(coalesce((it ->> 'discount')::numeric, 0), 2), 0), v_gross);

    insert into sale_items (sale_id, product_id, product_name, presentation, category_id, quantity, unit_price, discount, line_total)
    values (v_sale.id, pr.id, pr.name, pr.presentation, pr.category_id, v_qty, pr.price, v_disc, v_gross - v_disc)
    returning id into v_item_id;

    insert into sale_item_costs (sale_item_id, unit_cost)
    select v_item_id, cost from product_costs where product_id = pr.id;

    update products set stock = stock - v_qty where id = pr.id;
    insert into inventory_movements (product_id, type, quantity, stock_after, reason, sale_id, user_id)
    values (pr.id, 'venta', -v_qty, pr.stock - v_qty, 'Venta #' || v_sale.number, v_sale.id, auth.uid());

    v_subtotal := v_subtotal + v_gross;
    v_line_disc := v_line_disc + v_disc;
  end loop;

  v_global := least(greatest(round(coalesce((p ->> 'global_discount')::numeric, 0), 2), 0), v_subtotal - v_line_disc);
  v_total := v_subtotal - v_line_disc - v_global;

  for pay in select * from jsonb_array_elements(coalesce(p -> 'payments', '[]'::jsonb)) loop
    case pay ->> 'method'
      when 'efectivo' then v_cash_given := v_cash_given + greatest(coalesce((pay ->> 'amount')::numeric, 0), 0);
      when 'transferencia' then
        v_transfer := v_transfer + greatest(coalesce((pay ->> 'amount')::numeric, 0), 0);
        v_ref := coalesce(nullif(pay ->> 'reference', ''), v_ref);
      when 'fiado' then v_credit := v_credit + greatest(coalesce((pay ->> 'amount')::numeric, 0), 0);
      else raise exception 'Método de pago inválido';
    end case;
  end loop;

  if v_credit > 0 and v_customer is null then raise exception 'Selecciona un cliente para vender fiado'; end if;
  if v_transfer + v_credit > v_total + 0.009 then raise exception 'Los pagos no en efectivo superan el total'; end if;
  v_cash_applied := v_total - v_transfer - v_credit;
  if v_cash_given + 0.009 < v_cash_applied then
    raise exception 'Pago incompleto: faltan RD$ %', to_char(v_cash_applied - v_cash_given, 'FM999G999G990D00');
  end if;

  if v_cash_applied > 0 then insert into sale_payments (sale_id, method, amount) values (v_sale.id, 'efectivo', v_cash_applied); end if;
  if v_transfer > 0 then insert into sale_payments (sale_id, method, amount, reference) values (v_sale.id, 'transferencia', v_transfer, v_ref); end if;
  if v_credit > 0 then
    insert into sale_payments (sale_id, method, amount) values (v_sale.id, 'fiado', v_credit);
    update customers set balance = balance + v_credit where id = v_customer;
  end if;

  update sales set
    subtotal = v_subtotal, line_discount = v_line_disc, global_discount = v_global, total = v_total,
    cash_received = v_cash_given, change_amount = greatest(v_cash_given - v_cash_applied, 0), credit_amount = v_credit
  where id = v_sale.id
  returning * into v_sale;

  return v_sale;
end $$;

-- ---------- Anular venta (solo admin) ----------
create or replace function public.void_sale(p_sale uuid, p_reason text) returns public.sales
language plpgsql security definer set search_path = public as $$
declare v_sale sales; it sale_items; v_stock numeric;
begin
  if not is_admin() then raise exception 'Solo la administradora puede anular ventas'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Indica el motivo de la anulación'; end if;
  select * into v_sale from sales where id = p_sale for update;
  if v_sale.id is null then raise exception 'Venta no encontrada'; end if;
  if v_sale.status = 'anulada' then raise exception 'La venta ya está anulada'; end if;

  perform set_config('app.stock_ctx', 'void', true);
  for it in select * from sale_items where sale_id = p_sale loop
    if it.product_id is not null then
      update products set stock = stock + it.quantity where id = it.product_id returning stock into v_stock;
      insert into inventory_movements (product_id, type, quantity, stock_after, reason, sale_id, user_id)
      values (it.product_id, 'anulacion', it.quantity, v_stock, 'Anulación venta #' || v_sale.number || ': ' || p_reason, p_sale, auth.uid());
    end if;
  end loop;

  if v_sale.credit_amount > 0 and v_sale.customer_id is not null then
    update customers set balance = balance - v_sale.credit_amount where id = v_sale.customer_id;
  end if;

  update sales set status = 'anulada', voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
  where id = p_sale returning * into v_sale;
  return v_sale;
end $$;

-- ---------- Abono de cliente ----------
create or replace function public.register_customer_payment(p_customer uuid, p_amount numeric, p_method public.payment_method, p_note text default null)
returns public.customer_payments
language plpgsql security definer set search_path = public as $$
declare v_pay customer_payments; v_session uuid; v_balance numeric;
begin
  if not is_active_user() then raise exception 'Usuario no autorizado'; end if;
  if p_method = 'fiado' then raise exception 'Método inválido para un abono'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;
  select balance into v_balance from customers where id = p_customer for update;
  if v_balance is null then raise exception 'Cliente no encontrado'; end if;
  if p_amount > v_balance + 0.009 then raise exception 'El abono supera el balance pendiente (RD$ %)', v_balance; end if;
  select id into v_session from cash_sessions where user_id = auth.uid() and closed_at is null;
  if p_method = 'efectivo' and v_session is null then raise exception 'Abre la caja para recibir abonos en efectivo'; end if;

  insert into customer_payments (customer_id, amount, method, note, user_id, cash_session_id)
  values (p_customer, round(p_amount, 2), p_method, nullif(trim(p_note), ''), auth.uid(), v_session)
  returning * into v_pay;
  update customers set balance = balance - round(p_amount, 2) where id = p_customer;
  return v_pay;
end $$;

-- ---------- Inventario (solo admin) ----------
create or replace function public.inventory_entry(p_product uuid, p_quantity numeric, p_unit_cost numeric default null,
  p_supplier text default null, p_note text default null, p_update_cost boolean default true)
returns public.inventory_movements
language plpgsql security definer set search_path = public as $$
declare v_mov inventory_movements; v_stock numeric;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  if coalesce(p_quantity, 0) <= 0 then raise exception 'La cantidad debe ser mayor que cero'; end if;
  perform set_config('app.stock_ctx', 'entry', true);
  update products set stock = stock + p_quantity where id = p_product returning stock into v_stock;
  if v_stock is null then raise exception 'Producto no encontrado'; end if;
  insert into inventory_movements (product_id, type, quantity, stock_after, unit_cost, supplier, reason, user_id)
  values (p_product, 'entrada', p_quantity, v_stock, p_unit_cost, nullif(trim(p_supplier), ''), coalesce(nullif(trim(p_note), ''), 'Entrada de mercancía'), auth.uid())
  returning * into v_mov;
  if p_update_cost and p_unit_cost is not null then
    insert into product_costs (product_id, cost) values (p_product, p_unit_cost)
    on conflict (product_id) do update set cost = excluded.cost, updated_at = now();
  end if;
  return v_mov;
end $$;

create or replace function public.inventory_adjust(p_product uuid, p_new_stock numeric, p_reason text)
returns public.inventory_movements
language plpgsql security definer set search_path = public as $$
declare v_mov inventory_movements; v_old numeric;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Indica el motivo del ajuste'; end if;
  if p_new_stock is null or p_new_stock < 0 then raise exception 'Stock inválido'; end if;
  select stock into v_old from products where id = p_product for update;
  if v_old is null then raise exception 'Producto no encontrado'; end if;
  perform set_config('app.stock_ctx', 'adjust', true);
  update products set stock = p_new_stock where id = p_product;
  insert into inventory_movements (product_id, type, quantity, stock_after, reason, user_id)
  values (p_product, 'ajuste', p_new_stock - v_old, p_new_stock, trim(p_reason), auth.uid())
  returning * into v_mov;
  return v_mov;
end $$;

-- ---------- Dashboard ----------
create or replace function public.dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz constant text := 'America/Santo_Domingo';
  v_today date := (now() at time zone tz)::date;
  v_week date := date_trunc('week', (now() at time zone tz))::date;
  v_month date := date_trunc('month', (now() at time zone tz))::date;
  v_admin boolean := is_admin();
  v_uid uuid := auth.uid();
  r jsonb;
begin
  if not is_active_user() then raise exception 'No autorizado'; end if;

  with s as (
    select sa.*, (sa.created_at at time zone tz)::date as d
    from sales sa
    where sa.status = 'completada'
      and sa.created_at >= ((v_today - 60)::timestamp at time zone tz)
      and (v_admin or sa.user_id = v_uid)
  ),
  profit as (
    select (sa.created_at at time zone tz)::date as d,
           -- ganancia solo de líneas con costo conocido; descuento global prorrateado
           sum(case when c.unit_cost is not null then
                 si.line_total * (1 - case when (sa.subtotal - sa.line_discount) > 0 then sa.global_discount / (sa.subtotal - sa.line_discount) else 0 end)
                 - c.unit_cost * si.quantity end) as p,
           bool_or(c.unit_cost is null) as missing
    from sales sa
    join sale_items si on si.sale_id = sa.id
    left join sale_item_costs c on c.sale_item_id = si.id
    where v_admin and sa.status = 'completada'
      and sa.created_at >= ((v_month - 1)::timestamp at time zone tz)
    group by 1
  ),
  days as (
    select g::date as d from generate_series(v_today - 29, v_today, interval '1 day') g
  )
  select jsonb_build_object(
    'is_admin', v_admin,
    'today', jsonb_build_object(
      'total', coalesce((select sum(total) from s where d = v_today), 0),
      'count', (select count(*) from s where d = v_today),
      'yesterday_total', coalesce((select sum(total) from s where d = v_today - 1), 0)),
    'week', jsonb_build_object(
      'total', coalesce((select sum(total) from s where d >= v_week), 0),
      'count', (select count(*) from s where d >= v_week)),
    'month', jsonb_build_object(
      'total', coalesce((select sum(total) from s where d >= v_month), 0),
      'count', (select count(*) from s where d >= v_month)),
    'profit', case when v_admin then jsonb_build_object(
      'today', coalesce((select p from profit where d = v_today), 0),
      'with_cost', exists (select 1 from product_costs where cost is not null),
      'month', coalesce((select sum(p) from profit where d >= v_month), 0),
      'missing_costs', coalesce((select bool_or(missing) from profit where d >= v_month), false)) end,
    'series', (select jsonb_agg(jsonb_build_object(
        'date', days.d,
        'total', coalesce((select sum(total) from s where s.d = days.d), 0),
        'count', (select count(*) from s where s.d = days.d)) order by days.d) from days),
    'top_products', (select coalesce(jsonb_agg(t order by t.revenue desc), '[]'::jsonb) from (
        select si.product_name as name, si.presentation, sum(si.quantity) as qty, sum(si.line_total) as revenue
        from sale_items si join s on s.id = si.sale_id
        where s.d >= v_today - 29
        group by si.product_name, si.presentation
        order by sum(si.line_total) desc limit 6) t),
    'payment_mix', (select coalesce(jsonb_object_agg(method, amt), '{}'::jsonb) from (
        select p.method, sum(p.amount) as amt from sale_payments p join s on s.id = p.sale_id
        where s.d >= v_month group by p.method) pm),
    'low_stock', (select coalesce(jsonb_agg(l), '[]'::jsonb) from (
        select id, name, presentation, stock, min_stock from products
        where active and stock <= min_stock order by stock asc, name limit 12) l),
    'low_stock_count', (select count(*) from products where active and stock <= min_stock),
    'expiring', (select coalesce(jsonb_agg(e), '[]'::jsonb) from (
        select id, name, presentation, expiry_date, stock from products
        where active and expiry_date is not null
          and expiry_date <= v_today + (select expiry_alert_days from business_settings where id = 1)
        order by expiry_date limit 12) e),
    'no_price_count', (select count(*) from products where active and price <= 0),
    'credit_total', (select coalesce(sum(balance), 0) from customers where balance > 0),
    'customers_count', (select count(*) from customers where active)
  ) into r;
  return r;
end $$;

-- ---------- Reportes (solo admin) ----------
create or replace function public.report_items(p_from date, p_to date)
returns table (
  sale_id uuid, sale_number bigint, sale_date date, created_at timestamptz,
  user_id uuid, user_name text, category_id uuid, category_name text,
  product_id uuid, product_name text, presentation text,
  quantity numeric, revenue numeric, cost numeric, has_cost boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  return query
  select sa.id, sa.number, (sa.created_at at time zone 'America/Santo_Domingo')::date, sa.created_at,
         sa.user_id, pf.full_name, si.category_id, coalesce(c.name, 'Sin categoría'),
         si.product_id, si.product_name, si.presentation,
         si.quantity,
         -- el descuento global se reparte proporcionalmente entre las líneas
         round(si.line_total - case when (sa.subtotal - sa.line_discount) > 0
               then sa.global_discount * si.line_total / (sa.subtotal - sa.line_discount) else 0 end, 2),
         round(coalesce(sc.unit_cost, 0) * si.quantity, 2),
         sc.unit_cost is not null
  from sales sa
  join sale_items si on si.sale_id = sa.id
  left join sale_item_costs sc on sc.sale_item_id = si.id
  left join categories c on c.id = si.category_id
  left join profiles pf on pf.id = sa.user_id
  where sa.status = 'completada'
    and sa.created_at >= (p_from::timestamp at time zone 'America/Santo_Domingo')
    and sa.created_at < ((p_to + 1)::timestamp at time zone 'America/Santo_Domingo')
  order by sa.created_at;
end $$;

-- ---------- Limpiar datos demo (solo admin) ----------
create or replace function public.clear_demo_data(p_reset_stock boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_sales int; v_customers int;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  select count(*) into v_sales from sales;
  select count(*) into v_customers from customers;
  delete from customer_payments where true;
  delete from sale_payments where true;
  delete from sale_item_costs where true;
  delete from sale_items where true;
  delete from inventory_movements where true;
  delete from sales where true;
  delete from cash_sessions where true;
  delete from customers where true;
  perform setval('sale_number_seq', 1, false);
  if p_reset_stock then
    perform set_config('app.stock_ctx', 'reset', true);
    update products set stock = 0 where true;
  end if;
  return jsonb_build_object('sales_deleted', v_sales, 'customers_deleted', v_customers);
end $$;

-- ---------- Permisos de ejecución ----------
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.current_role_name(), public.is_active_user(), public.is_admin(),
  public.current_cash_session(), public.open_cash_session(numeric, text),
  public.cash_session_summary(uuid), public.close_cash_session(uuid, numeric, text),
  public.create_sale(jsonb), public.void_sale(uuid, text),
  public.register_customer_payment(uuid, numeric, public.payment_method, text),
  public.inventory_entry(uuid, numeric, numeric, text, text, boolean),
  public.inventory_adjust(uuid, numeric, text),
  public.dashboard_stats(), public.report_items(date, date),
  public.clear_demo_data(boolean)
to authenticated;
