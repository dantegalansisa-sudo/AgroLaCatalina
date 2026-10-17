-- =============================================================
-- La Catalina POS — Esquema base
-- =============================================================
set check_function_bodies = off;

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
do $$ begin
  create type public.user_role as enum ('admin', 'cajero');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('efectivo', 'transferencia', 'fiado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.movement_type as enum ('inicial', 'entrada', 'ajuste', 'venta', 'anulacion');
exception when duplicate_object then null; end $$;

-- ---------- Configuración del negocio (fila única) ----------
create table if not exists public.business_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'Agro Veterinaria y Ferretería La Catalina',
  short_name text not null default 'La Catalina',
  address text default 'Cabrera, Nagua, República Dominicana',
  phone text default '809-923-8210',
  email text,
  rnc text,
  logo_url text,
  receipt_message text default '¡Gracias por su compra! Su confianza es nuestro compromiso.',
  allow_negative_stock boolean not null default false,
  expiry_alert_days int not null default 30,
  updated_at timestamptz not null default now()
);

-- ---------- Perfiles de usuario ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.user_role not null default 'cajero',
  active boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Categorías ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default 'package',
  color text not null default 'slate',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Productos ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  presentation text,
  category_id uuid references public.categories (id) on delete set null,
  barcode text unique,
  price numeric(12,2) not null default 0 check (price >= 0),
  stock numeric(12,2) not null default 0,
  min_stock numeric(12,2) not null default 3,
  expiry_date date,
  active boolean not null default true,
  image_url text, -- reservado para el futuro
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_name_idx on public.products (lower(name));

-- Costos separados: solo la administradora puede verlos (RLS)
create table if not exists public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  cost numeric(12,2) check (cost >= 0),
  updated_at timestamptz not null default now()
);

-- ---------- Clientes ----------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  notes text,
  balance numeric(12,2) not null default 0,
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists customers_name_idx on public.customers (lower(name));

-- ---------- Caja ----------
create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  opened_at timestamptz not null default now(),
  opening_amount numeric(12,2) not null default 0,
  closed_at timestamptz,
  expected_cash numeric(12,2),
  counted_cash numeric(12,2),
  difference numeric(12,2),
  summary jsonb,
  notes text,
  is_demo boolean not null default false
);
create unique index if not exists cash_sessions_one_open_per_user
  on public.cash_sessions (user_id) where closed_at is null;

-- ---------- Ventas ----------
create sequence if not exists public.sale_number_seq start 1;

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.sale_number_seq'),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id),
  customer_id uuid references public.customers (id) on delete set null,
  cash_session_id uuid references public.cash_sessions (id) on delete set null,
  subtotal numeric(12,2) not null default 0,
  line_discount numeric(12,2) not null default 0,
  global_discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  cash_received numeric(12,2) not null default 0,
  change_amount numeric(12,2) not null default 0,
  credit_amount numeric(12,2) not null default 0,
  note text,
  status text not null default 'completada' check (status in ('completada', 'anulada')),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  void_reason text,
  is_demo boolean not null default false
);
create index if not exists sales_created_idx on public.sales (created_at desc);
create index if not exists sales_customer_idx on public.sales (customer_id);
create index if not exists sales_user_idx on public.sales (user_id);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  presentation text,
  category_id uuid,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  line_total numeric(12,2) not null
);
create index if not exists sale_items_sale_idx on public.sale_items (sale_id);
create index if not exists sale_items_product_idx on public.sale_items (product_id);

-- Costo al momento de la venta (solo admin)
create table if not exists public.sale_item_costs (
  sale_item_id uuid primary key references public.sale_items (id) on delete cascade,
  unit_cost numeric(12,2)
);

create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  method public.payment_method not null,
  amount numeric(12,2) not null check (amount >= 0),
  reference text
);
create index if not exists sale_payments_sale_idx on public.sale_payments (sale_id);

-- ---------- Abonos de clientes (fiado) ----------
create table if not exists public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method public.payment_method not null default 'efectivo' check (method <> 'fiado'),
  note text,
  user_id uuid not null references public.profiles (id),
  cash_session_id uuid references public.cash_sessions (id) on delete set null,
  created_at timestamptz not null default now(),
  is_demo boolean not null default false
);
create index if not exists customer_payments_customer_idx on public.customer_payments (customer_id);

-- ---------- Movimientos de inventario ----------
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  type public.movement_type not null,
  quantity numeric(12,2) not null, -- con signo
  stock_after numeric(12,2) not null,
  unit_cost numeric(12,2),
  supplier text,
  reason text,
  sale_id uuid references public.sales (id) on delete set null,
  user_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  is_demo boolean not null default false
);
create index if not exists inventory_movements_product_idx on public.inventory_movements (product_id, created_at desc);

-- ---------- updated_at ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
