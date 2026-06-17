-- Platform admin management: delete users, manage workspaces, protect is_platform_admin.

-- ---------------------------------------------------------------------------
-- Block direct client updates to is_platform_admin (use admin_set_platform_admin)
-- ---------------------------------------------------------------------------
create or replace function public.guard_profiles_platform_admin ()
  returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  if new.is_platform_admin is distinct from old.is_platform_admin then
    if coalesce(current_setting('app.allow_admin_flag_change', true), '') <> 'true' then
      raise exception 'cannot_change_platform_admin_directly' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_platform_admin on public.profiles;

create trigger profiles_guard_platform_admin
  before update on public.profiles
  for each row
  when (old.is_platform_admin is distinct from new.is_platform_admin)
  execute function public.guard_profiles_platform_admin ();

-- ---------------------------------------------------------------------------
-- Internal helper
-- ---------------------------------------------------------------------------
create or replace function public.assert_platform_admin ()
  returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_uid uuid := auth.uid ();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles ad
    where ad.id = v_uid
      and ad.is_platform_admin = true
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return v_uid;
end;
$$;

revoke all on function public.assert_platform_admin () from public;
grant execute on function public.assert_platform_admin () to authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard overview stats
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_overview ()
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  perform public.assert_platform_admin ();

  return jsonb_build_object(
    'users_count', (select count(*)::int from public.profiles),
    'platform_admins_count', (select count(*)::int from public.profiles where is_platform_admin),
    'organizations_count', (select count(*)::int from public.organizations),
    'contact_submissions_count', (select count(*)::int from public.contact_submissions),
    'total_leads', (select count(*)::int from public.leads),
    'total_appointments', (select count(*)::int from public.appointments)
  );
end;
$$;

revoke all on function public.admin_get_overview () from public;
grant execute on function public.admin_get_overview () to authenticated;

-- ---------------------------------------------------------------------------
-- Contact submissions (service_role-only table; admin reads via RPC)
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_contact_submissions (p_limit int default 50)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  perform public.assert_platform_admin ();

  return coalesce((
    select jsonb_agg(to_jsonb(c) order by c.created_at desc)
    from (
      select id, created_at, name, email, message, company
      from public.contact_submissions
      order by created_at desc
      limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) c
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_get_contact_submissions (int) from public;
grant execute on function public.admin_get_contact_submissions (int) to authenticated;

-- ---------------------------------------------------------------------------
-- Promote / demote platform admin
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_platform_admin (p_user_id uuid, p_is_admin boolean)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := public.assert_platform_admin ();

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  if p_user_id = v_uid and not p_is_admin then
    raise exception 'cannot_demote_self' using errcode = '42501';
  end if;

  if not p_is_admin and exists (
    select 1
    from public.profiles
    where id = p_user_id
      and is_platform_admin
  ) and (
    select count(*)
    from public.profiles
    where is_platform_admin
  ) <= 1 then
    raise exception 'cannot_remove_last_admin' using errcode = '42501';
  end if;

  perform set_config('app.allow_admin_flag_change', 'true', true);
  update public.profiles
  set is_platform_admin = p_is_admin,
      updated_at = now()
  where id = p_user_id;
  perform set_config('app.allow_admin_flag_change', 'false', true);
end;
$$;

revoke all on function public.admin_set_platform_admin (uuid, boolean) from public;
grant execute on function public.admin_set_platform_admin (uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Update workspace billing / voice quota
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_organization (
  p_org_id uuid,
  p_subscription_status text default null,
  p_plan_name text default null,
  p_voice_limit numeric default null,
  p_reset_usage boolean default false
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  perform public.assert_platform_admin ();

  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  if p_subscription_status is not null
    and p_subscription_status not in ('free', 'active', 'past_due', 'canceled') then
    raise exception 'invalid_subscription_status' using errcode = '22023';
  end if;

  if p_plan_name is not null
    and p_plan_name not in ('free', 'starter', 'pro', 'enterprise') then
    raise exception 'invalid_plan_name' using errcode = '22023';
  end if;

  update public.organizations o
  set
    subscription_status = coalesce(p_subscription_status, o.subscription_status),
    plan_name = coalesce(p_plan_name, o.plan_name),
    monthly_voice_minutes_limit = coalesce(p_voice_limit, o.monthly_voice_minutes_limit),
    monthly_voice_minutes_used = case
      when p_reset_usage then 0
      else o.monthly_voice_minutes_used
    end
  where o.id = p_org_id;
end;
$$;

revoke all on function public.admin_update_organization (uuid, text, text, numeric, boolean) from public;
grant execute on function public.admin_update_organization (uuid, text, text, numeric, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Delete workspace and all tenant data (cascade)
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_organization (p_org_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  perform public.assert_platform_admin ();

  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  delete from public.organizations
  where id = p_org_id;
end;
$$;

revoke all on function public.admin_delete_organization (uuid) from public;
grant execute on function public.admin_delete_organization (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Delete user account (auth + profile + sole-owned workspaces)
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_user (p_user_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, auth
as $$
declare
  v_uid uuid;
begin
  v_uid := public.assert_platform_admin ();

  if p_user_id = v_uid then
    raise exception 'cannot_delete_self' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = p_user_id
      and is_platform_admin
  ) and (
    select count(*)
    from public.profiles
    where is_platform_admin
  ) <= 1 then
    raise exception 'cannot_delete_last_admin' using errcode = '42501';
  end if;

  -- Remove workspaces where this user is the only member
  delete from public.organizations o
  where exists (
    select 1
    from public.organization_members m
    where m.organization_id = o.id
      and m.user_id = p_user_id
  )
  and not exists (
    select 1
    from public.organization_members m2
    where m2.organization_id = o.id
      and m2.user_id <> p_user_id
  );

  delete from public.organization_members
  where user_id = p_user_id;

  delete from auth.users
  where id = p_user_id;
end;
$$;

revoke all on function public.admin_delete_user (uuid) from public;
grant execute on function public.admin_delete_user (uuid) to authenticated;
