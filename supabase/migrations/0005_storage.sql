-- =============================================================
-- Almacenamiento del logo del negocio (bucket público "branding")
-- =============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists branding_admin_insert on storage.objects;
create policy branding_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.is_admin());

drop policy if exists branding_admin_update on storage.objects;
create policy branding_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.is_admin());

drop policy if exists branding_admin_delete on storage.objects;
create policy branding_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.is_admin());
