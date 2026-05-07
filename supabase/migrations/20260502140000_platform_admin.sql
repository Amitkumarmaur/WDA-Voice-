-- Platform admins: separate dashboard data via SECURITY DEFINER RPCs only.
-- Promote a user (run in SQL editor): update public.profiles set is_platform_admin = true where email = 'you@example.com';

alter table public.profiles
  add column if not exists is_platform_admin boolean not null default false;

comment on column public.profiles.is_platform_admin is
  'Allows calling admin_get_users_directory / admin_get_user_detail. Set manually in SQL.';

-- Callable from the client; reads only the caller''s flag under normal RLS.
create or replace function public.is_platform_admin ()
  returns boolean
  language sql
  stable
  security invoker
  set search_path = public
as $$
  select coalesce(
    (
      select p.is_platform_admin
      from public.profiles p
      where p.id = auth.uid ()
    ),
    false
  );
$$;

revoke all on function public.is_platform_admin () from public;
grant execute on function public.is_platform_admin () to authenticated;

create or replace function public.admin_get_users_directory ()
  returns jsonb
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

  return (
    select coalesce(jsonb_agg(entry order by entry.user_created_at desc nulls last), '[]'::jsonb)
    from (
      select
        p.id as user_id,
        p.email,
        p.full_name,
        p.avatar_url,
        p.created_at as user_created_at,
        p.updated_at as user_updated_at,
        p.is_platform_admin as user_is_platform_admin,
        m.organization_id,
        m.role as org_role,
        o.name as org_name,
        o.public_slug,
        o.subscription_status,
        o.stripe_customer_id,
        o.monthly_voice_minutes_used,
        o.monthly_voice_minutes_limit,
        o.created_at as org_created_at,
        (
          select count(*)::int
          from public.knowledge_items k
          where k.organization_id = m.organization_id
        ) as knowledge_count,
        (
          select count(*)::int
          from public.leads l
          where l.organization_id = m.organization_id
        ) as leads_count,
        (
          select count(*)::int
          from public.appointments a
          where a.organization_id = m.organization_id
        ) as appointments_count,
        (
          select count(*)::int
          from public.transcripts t
          where t.organization_id = m.organization_id
        ) as transcripts_count,
        (
          select count(*)::int
          from public.voice_profiles v
          where v.organization_id = m.organization_id
        ) as voice_profiles_count
      from public.profiles p
      left join public.organization_members m
        on m.user_id = p.id
      left join public.organizations o
        on o.id = m.organization_id
    ) entry
  );
end;
$$;

revoke all on function public.admin_get_users_directory () from public;
grant execute on function public.admin_get_users_directory () to authenticated;

create or replace function public.admin_get_user_detail (p_user_id uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_uid uuid := auth.uid ();
  v_profile jsonb;
  v_memberships jsonb;
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

  select to_jsonb(p)
  into v_profile
  from public.profiles p
  where p.id = p_user_id;

  if v_profile is null then
    return null;
  end if;

  select coalesce(jsonb_agg(memb order by org_created_at desc nulls last), '[]'::jsonb)
  into v_memberships
  from (
    select jsonb_build_object(
      'role', m.role,
      'organization', to_jsonb(o),
      'agent_settings', (
        select to_jsonb(a)
        from public.agent_settings a
        where a.organization_id = o.id
      ),
      'voice_profile', (
        select to_jsonb(v)
        from public.voice_profiles v
        where v.organization_id = o.id
        order by v.created_at desc
        limit 1
      ),
      'subscription', (
        select to_jsonb(s)
        from public.organization_subscriptions s
        where s.organization_id = o.id
      ),
      'counts', jsonb_build_object(
        'knowledge', (select count(*)::int from public.knowledge_items k where k.organization_id = o.id),
        'leads', (select count(*)::int from public.leads l where l.organization_id = o.id),
        'appointments', (select count(*)::int from public.appointments a where a.organization_id = o.id),
        'transcripts', (select count(*)::int from public.transcripts t where t.organization_id = o.id),
        'voice_profiles', (select count(*)::int from public.voice_profiles v where v.organization_id = o.id)
      ),
      'recent_leads', (
        select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
        from (
          select id, name, email, interest, conversation_id, created_at
          from public.leads
          where organization_id = o.id
          order by created_at desc
          limit 15
        ) l
      ),
      'recent_appointments', (
        select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
        from (
          select id, name, email, date, notes, created_at
          from public.appointments
          where organization_id = o.id
          order by created_at desc
          limit 15
        ) a
      ),
      'recent_transcripts', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', x.id,
          'created_at', x.created_at,
          'message_count', jsonb_array_length(x.messages)
        )), '[]'::jsonb)
        from (
          select id, messages, created_at
          from public.transcripts
          where organization_id = o.id
          order by created_at desc
          limit 10
        ) x
      ),
      'sample_knowledge', (
        select coalesce(jsonb_agg(to_jsonb(k)), '[]'::jsonb)
        from (
          select id, title, source, type, created_at
          from public.knowledge_items
          where organization_id = o.id
          order by created_at desc
          limit 8
        ) k
      )
    ) as memb,
    o.created_at as org_created_at
    from public.organization_members m
    join public.organizations o
      on o.id = m.organization_id
    where m.user_id = p_user_id
  ) sub;

  return jsonb_build_object(
    'profile', v_profile,
    'memberships', coalesce(v_memberships, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_get_user_detail (uuid) from public;
grant execute on function public.admin_get_user_detail (uuid) to authenticated;
