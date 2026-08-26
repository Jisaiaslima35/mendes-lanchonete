-- ============================================================================
-- 0004_storage.sql — Bucket de mídia (produtos, categorias, promoções, marca)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('midia', 'midia', true)
on conflict (id) do nothing;

create policy midia_public_read on storage.objects
  for select using (bucket_id = 'midia');

create policy midia_admin_insert on storage.objects
  for insert with check (bucket_id = 'midia' and is_admin());

create policy midia_admin_update on storage.objects
  for update using (bucket_id = 'midia' and is_admin())
  with check (bucket_id = 'midia' and is_admin());

create policy midia_admin_delete on storage.objects
  for delete using (bucket_id = 'midia' and is_admin());
