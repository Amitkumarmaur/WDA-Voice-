-- Backfill path for users created before the auth trigger (or if trigger failed)

create or replace function public.ensure_my_organization ()
  returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_uid uuid;
  v_org uuid;
begin
  v_uid := auth.uid ();
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select organization_id into v_org
  from public.organization_members
  where user_id = v_uid
  limit 1;

  if v_org is not null then
    return v_org;
  end if;

  insert into public.organizations (name)
    values ('My workspace')
  returning id into v_org;

  insert into public.organization_members (organization_id, user_id, role)
    values (v_org, v_uid, 'owner');

  insert into public.agent_settings (organization_id, intro, persona_id, language)
    values (v_org, '', '', 'english')
  on conflict (organization_id) do nothing;

  return v_org;
end;
$$;

grant execute on function public.ensure_my_organization () to authenticated;
