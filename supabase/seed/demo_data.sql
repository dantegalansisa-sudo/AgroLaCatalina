-- =============================================================
-- Datos DEMO: 2 clientes, cajas y ventas de los últimos 14 días.
-- Requiere que existan los usuarios demo (scripts/seed-demo.mjs).
-- Se puede borrar desde Configuración → "Limpiar datos demo".
-- =============================================================
do $$
declare
  tz constant text := 'America/Santo_Domingo';
  v_admin uuid := (select id from profiles where email = 'admin@lacatalina.demo');
  v_cajero uuid := (select id from profiles where email = 'cajero@lacatalina.demo');
  v_c1 uuid; v_c2 uuid;
  v_day int; v_user uuid; v_session uuid; v_sale uuid; v_num bigint;
  v_n_sales int; v_n_items int; i int; j int;
  v_at timestamptz; v_open timestamptz; v_local_now timestamp := now() at time zone tz;
  pr record; v_qty numeric; v_sub numeric; v_total numeric; v_disc numeric;
  v_r float; v_method payment_method; v_customer uuid; v_cash_given numeric;
begin
  if v_admin is null or v_cajero is null then raise exception 'Faltan usuarios demo'; end if;
  if exists (select 1 from sales where is_demo) then
    raise notice 'Ya existen ventas demo, no se vuelven a crear';
    return;
  end if;

  perform setseed(0.42);
  perform set_config('app.stock_ctx', 'seed', true);

  -- Fechas de vencimiento de ejemplo para alertas
  update products set expiry_date = (v_local_now::date + 12) where name = 'Oxitetraciclina 50 mg';
  update products set expiry_date = (v_local_now::date + 25) where name = 'Ganadil Pituit';
  update products set expiry_date = (v_local_now::date - 3)  where name = 'Complejo-B Alfa' and presentation = '25 ml';
  update products set expiry_date = (v_local_now::date + 180) where name = 'Revimín';

  insert into customers (name, phone, address, notes, is_demo)
  values ('Juan Pérez (Finca El Cacao)', '809-555-0101', 'Los Gajitos, Cabrera', 'Ganadero, compra mensual', true)
  returning id into v_c1;
  insert into customers (name, phone, address, notes, is_demo)
  values ('María Rodríguez', '829-555-0202', 'Centro, Cabrera', 'Tiene mascotas y huerto', true)
  returning id into v_c2;

  for v_day in reverse 13..0 loop
    foreach v_user in array array[v_cajero, v_admin] loop
      if v_user = v_admin and random() < 0.4 then continue; end if;
      v_open := ((v_local_now::date - v_day) + time '08:00') at time zone tz;
      -- si hoy todavía no son las 8:00, la caja de hoy abre unas horas antes de ahora
      if v_open > now() - interval '1 hour' then v_open := now() - interval '3 hours'; end if;
      insert into cash_sessions (user_id, opened_at, opening_amount, is_demo)
      values (v_user, v_open, case when v_user = v_cajero then 2000 else 1000 end, true)
      returning id into v_session;

      v_n_sales := 2 + floor(random() * (case when v_user = v_cajero then 6 else 3 end))::int;
      for i in 1..v_n_sales loop
        v_at := v_open + make_interval(mins => floor(random() * 600)::int);
        if v_at > now() then v_at := now() - make_interval(mins => floor(random() * 90)::int); end if;
        if v_at < v_open then v_at := v_open + make_interval(mins => 5 + floor(random() * 60)::int); end if;
        if v_at > now() then v_at := now() - interval '2 minutes'; end if;

        insert into sales (created_at, user_id, cash_session_id, is_demo)
        values (v_at, v_user, v_session, true) returning id, number into v_sale, v_num;

        v_sub := 0;
        v_n_items := 1 + floor(random() * 3)::int;
        for j in 1..v_n_items loop
          select p.* into pr from products p
          where p.active and p.price > 0 and p.stock >= 2
            and not exists (select 1 from sale_items si where si.sale_id = v_sale and si.product_id = p.id)
          order by random() limit 1;
          exit when pr.id is null;
          v_qty := case when pr.price < 300 and random() < 0.4 then 2 else 1 end;
          insert into sale_items (sale_id, product_id, product_name, presentation, category_id, quantity, unit_price, discount, line_total)
          values (v_sale, pr.id, pr.name, pr.presentation, pr.category_id, v_qty, pr.price, 0, pr.price * v_qty);
          update products set stock = stock - v_qty where id = pr.id;
          insert into inventory_movements (product_id, type, quantity, stock_after, reason, sale_id, user_id, created_at, is_demo)
          values (pr.id, 'venta', -v_qty, pr.stock - v_qty, 'Venta #' || v_num, v_sale, v_user, v_at, true);
          v_sub := v_sub + pr.price * v_qty;
        end loop;

        if v_sub = 0 then delete from sales where id = v_sale; continue; end if;

        v_disc := case when v_sub > 1000 and random() < 0.25 then 50 else 0 end;
        v_total := v_sub - v_disc;
        v_r := random();
        v_customer := null;
        if v_r < 0.66 then v_method := 'efectivo';
        elsif v_r < 0.88 then v_method := 'transferencia';
        else
          v_method := 'fiado';
          v_customer := case when random() < 0.6 then v_c1 else v_c2 end;
        end if;
        v_cash_given := case when v_method = 'efectivo' then ceil(v_total / 100) * 100 else 0 end;

        insert into sale_payments (sale_id, method, amount, reference)
        values (v_sale, v_method, v_total, case when v_method = 'transferencia' then 'BHD-' || (100000 + floor(random() * 899999))::int end);

        update sales set subtotal = v_sub, global_discount = v_disc, total = v_total, customer_id = v_customer,
          cash_received = v_cash_given, change_amount = greatest(v_cash_given - v_total, 0),
          credit_amount = case when v_method = 'fiado' then v_total else 0 end
        where id = v_sale;
        if v_method = 'fiado' then update customers set balance = balance + v_total where id = v_customer; end if;
      end loop;

      -- Cerrar cajas de días anteriores (la de hoy queda abierta)
      if v_day > 0 then
        update cash_sessions set
          closed_at = v_open + interval '10 hours',
          expected_cash = opening_amount + coalesce((select sum(p.amount) from sale_payments p join sales s on s.id = p.sale_id
                          where s.cash_session_id = v_session and p.method = 'efectivo'), 0),
          summary = null
        where id = v_session;
        update cash_sessions set
          counted_cash = expected_cash - case when random() < 0.2 then 50 else 0 end
        where id = v_session;
        update cash_sessions set difference = counted_cash - expected_cash where id = v_session;
      end if;
    end loop;
  end loop;

  -- Un abono de ejemplo
  insert into customer_payments (customer_id, amount, method, note, user_id, created_at, is_demo)
  select v_c1, least(500, balance), 'efectivo', 'Abono demo', v_cajero, now() - interval '3 days', true
  from customers where id = v_c1 and balance > 0;
  update customers c set balance = balance - coalesce((select sum(amount) from customer_payments cp where cp.customer_id = c.id), 0)
  where c.id = v_c1;
end $$;
