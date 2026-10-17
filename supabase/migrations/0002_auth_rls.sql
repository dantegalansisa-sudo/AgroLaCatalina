-- =============================================================
-- Roles, perfiles y Row Level Security
-- =============================================================

-- ---------- Helpers de rol ----------
create or replace function public.current_role_name() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'admin')
$$;

-- ---------- Perfil automático al crear usuario ----------
-- Todo usuario nuevo nace INACTIVO y como cajero. Solo la administradora
-- (vía /api/admin/users con la clave secreta) lo activa y asigna rol.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Activar RLS (por si acaso) ----------
alter table public.business_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.customers enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_item_costs enable row level security;
alter table public.sale_payments enable row level security;
alter table public.customer_payments enable row level security;
alter table public.inventory_movements enable row level security;

-- ---------- Privilegios base ----------
revoke all on all tables in schema public from anon;
revoke insert, update, delete on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
grant select on public.business_settings to anon;

-- Escritura directa permitida solo donde aplica (RLS decide quién)
grant update on public.business_settings to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant insert, update, delete on public.products to authenticated;
grant insert, update, delete on public.product_costs to authenticated;
grant insert, delete on public.customers to authenticated;
-- el balance del cliente solo cambia mediante funciones
grant update (name, phone, address, notes, active) on public.customers to authenticated;

-- ---------- Políticas ----------
-- business_settings
drop policy if exists settings_read on public.business_settings;
create policy settings_read on public.business_settings for select to anon, authenticated using (true);
drop policy if exists settings_admin_update on public.business_settings;
create policy settings_admin_update on public.business_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_user());

-- categories
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select to authenticated using (public.is_active_user());
drop policy if exists categories_admin on public.categories;
create policy categories_admin on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- products
drop policy if exists products_read on public.products;
create policy products_read on public.products for select to authenticated using (public.is_active_user());
drop policy if exists products_admin on public.products;
create policy products_admin on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- product_costs (solo admin)
drop policy if exists product_costs_admin on public.product_costs;
create policy product_costs_admin on public.product_costs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- customers
drop policy if exists customers_read on public.customers;
create policy customers_read on public.customers for select to authenticated using (public.is_active_user());
drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers for insert to authenticated
  with check (public.is_active_user() and balance = 0);
drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers for update to authenticated
  using (public.is_active_user()) with check (public.is_active_user());
drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers for delete to authenticated using (public.is_admin());

-- cash_sessions
drop policy if exists cash_sessions_read on public.cash_sessions;
create policy cash_sessions_read on public.cash_sessions for select to authenticated
  using (public.is_admin() or (user_id = auth.uid() and public.is_active_user()));

-- sales (cajero ve solo sus ventas)
drop policy if exists sales_read on public.sales;
create policy sales_read on public.sales for select to authenticated
  using (public.is_admin() or (user_id = auth.uid() and public.is_active_user()));

drop policy if exists sale_items_read on public.sale_items;
create policy sale_items_read on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));

drop policy if exists sale_payments_read on public.sale_payments;
create policy sale_payments_read on public.sale_payments for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));

drop policy if exists sale_item_costs_admin on public.sale_item_costs;
create policy sale_item_costs_admin on public.sale_item_costs for select to authenticated using (public.is_admin());

-- customer_payments
drop policy if exists customer_payments_read on public.customer_payments;
create policy customer_payments_read on public.customer_payments for select to authenticated
  using (public.is_active_user());

-- inventory_movements (solo admin)
drop policy if exists inventory_movements_admin on public.inventory_movements;
create policy inventory_movements_admin on public.inventory_movements for select to authenticated
  using (public.is_admin());

-- Secuencia de ventas: solo se usa desde funciones
revoke all on sequence public.sale_number_seq from anon, authenticated;
