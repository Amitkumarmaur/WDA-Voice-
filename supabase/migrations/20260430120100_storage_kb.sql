-- Private bucket for knowledge uploads: path = {organization_id}/{filename}

insert into storage.buckets (id, name, public)
  values ('kb-files', 'kb-files', false)
on conflict (id) do nothing;

create policy "kb_files_select_org_member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'kb-files'
    and exists (
      select 1
      from public.organization_members m
      where m.user_id = auth.uid ()
        and split_part(name, '/', 1) = m.organization_id::text
    )
  );

create policy "kb_files_insert_org_member"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'kb-files'
    and exists (
      select 1
      from public.organization_members m
      where m.user_id = auth.uid ()
        and split_part(name, '/', 1) = m.organization_id::text
    )
  );

create policy "kb_files_update_org_member"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'kb-files'
    and exists (
      select 1
      from public.organization_members m
      where m.user_id = auth.uid ()
        and split_part(name, '/', 1) = m.organization_id::text
    )
  )
  with check (
    bucket_id = 'kb-files'
    and exists (
      select 1
      from public.organization_members m
      where m.user_id = auth.uid ()
        and split_part(name, '/', 1) = m.organization_id::text
    )
  );

create policy "kb_files_delete_org_member"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'kb-files'
    and exists (
      select 1
      from public.organization_members m
      where m.user_id = auth.uid ()
        and split_part(name, '/', 1) = m.organization_id::text
    )
  );
