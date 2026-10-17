-- =============================================================
-- Limpia TODOS los datos transaccionales (ventas, cajas, clientes,
-- abonos, movimientos) y reinicia el consecutivo de recibos.
-- Conserva productos, precios, costos, categorías, usuarios y configuración.
-- Equivale al botón "Limpiar datos demo" de Configuración.
-- =============================================================
begin;
delete from public.customer_payments where true;
delete from public.sale_payments where true;
delete from public.sale_item_costs where true;
delete from public.sale_items where true;
delete from public.inventory_movements where true;
delete from public.sales where true;
delete from public.cash_sessions where true;
delete from public.customers where true;
select setval('public.sale_number_seq', 1, false);
commit;
