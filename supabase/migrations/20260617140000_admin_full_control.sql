-- Admin full-control extensions:
-- 1. Extended admin_update_organization (name, slug, twilio phone)
-- 2. admin_delete_contact_submission
-- 3. admin_get_all_leads
-- 4. admin_get_all_transcripts
-- 5. admin_get_platform_stats (totals for overview)
-- 6. admin_get_plans / admin_update_plan (Stripe price ID management)

-- ---------------------------------------------------------------------------
-- 1. Extend admin_update_organization with name, slug, twilio phone
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_organization (
  p_org_id              uuid,
  p_subscription_status text    default null,
  p_plan_name           text    default null,
  p_voice_limit         numeric default null,
  p_reset_usage         boolean default false,
  p_org_name            text    default null,
  p_public_slug         text    default null,
  p_twilio_phone        text    default null
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

  -- Slug must be unique; check before updating
  if p_public_slug is not null and exists (
    select 1 from public.organizations where public_slug = p_public_slug and id <> p_org_id
  ) then
    raise exception 'slug_already_taken' using errcode = '23505';
  end if;

  update public.organizations o
  set
    subscription_status          = coalesce(p_subscription_status, o.subscription_status),
    plan_name                    = coalesce(p_plan_name, o.plan_name),
    monthly_voice_minutes_limit  = coalesce(p_voice_limit, o.monthly_voice_minutes_limit),
    monthly_voice_minutes_used   = case when p_reset_usage then 0 else o.monthly_voice_minutes_used end,
    name                         = coalesce(p_org_name, o.name),
    public_slug                  = coalesce(p_public_slug, o.public_slug),
    twilio_phone_number          = coalesce(p_twilio_phone, o.twilio_phone_number)
  where o.id = p_org_id;
end;
$$;

revoke all on function public.admin_update_organization (uuid, text, text, numeric, boolean, text, text, text) from public;
grant execute on function public.admin_update_organization (uuid, text, text, numeric, boolean, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Delete a contact submission
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_contact_submission (p_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  perform public.assert_platform_admin ();

  delete from public.contact_submissions where id = p_id;
end;
$$;

revoke all on function public.admin_delete_contact_submission (uuid) from public;
grant execute on function public.admin_delete_contact_submission (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. All leads across all orgs
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_all_leads (p_limit int default 200)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  perform public.assert_platform_admin ();

  return coalesce((
    select jsonb_agg(row_to_json(r) order by r.created_at desc)
    from (
      select
        l.id,
        l.organization_id,
        o.name  as org_name,
        o.public_slug,
        l.name,
        l.email,
        l.phone,
        l.interest,
        l.source,
        l.created_at
      from public.leads l
      join public.organizations o on o.id = l.organization_id
      order by l.created_at desc
      limit greatest(1, least(coalesce(p_limit, 200), 1000))
    ) r
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_get_all_leads (int) from public;
grant execute on function public.admin_get_all_leads (int) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. All transcripts across all orgs (summary only, no full message blob)
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_all_transcripts (p_limit int default 100)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  perform public.assert_platform_admin ();

  return coalesce((
    select jsonb_agg(row_to_json(r) order by r.created_at desc)
    from (
      select
        t.id,
        t.organization_id,
        o.name       as org_name,
        o.public_slug,
        t.created_at,
        t.duration_seconds,
        jsonb_array_length(t.messages) as message_count,
        t.messages
      from public.transcripts t
      join public.organizations o on o.id = t.organization_id
      order by t.created_at desc
      limit greatest(1, least(coalesce(p_limit, 100), 500))
    ) r
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_get_all_transcripts (int) from public;
grant execute on function public.admin_get_all_transcripts (int) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Extended platform stats
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_platform_stats ()
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  perform public.assert_platform_admin ();

  return jsonb_build_object(
    'total_transcripts',      (select count(*)::int            from public.transcripts),
    'total_knowledge_items',  (select count(*)::int            from public.knowledge_items),
    'total_voice_minutes_used', (select coalesce(sum(monthly_voice_minutes_used), 0)::numeric from public.organizations),
    'active_subscriptions',   (select count(*)::int            from public.organizations where subscription_status = 'active'),
    'paid_this_month_orgs',   (select count(*)::int            from public.organizations where subscription_status in ('active','past_due')),
    'total_org_members',      (select count(*)::int            from public.organization_members)
  );
end;
$$;

revoke all on function public.admin_get_platform_stats () from public;
grant execute on function public.admin_get_platform_stats () to authenticated;

-- ---------------------------------------------------------------------------
-- 6a. Read plans table
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_plans ()
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  perform public.assert_platform_admin ();

  return coalesce((
    select jsonb_agg(to_jsonb(p) order by p.sort_order)
    from public.plans p
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_get_plans () from public;
grant execute on function public.admin_get_plans () to authenticated;

-- ---------------------------------------------------------------------------
-- 6b. Update a plan (stripe price ID, voice limit, display name)
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_plan (
  p_plan_id                    text,
  p_stripe_price_id            text    default null,
  p_monthly_voice_minutes_limit int    default null,
  p_display_name               text    default null,
  p_is_active                  boolean default null
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  perform public.assert_platform_admin ();

  if not exists (select 1 from public.plans where id = p_plan_id) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  update public.plans
  set
    stripe_price_id             = coalesce(p_stripe_price_id, stripe_price_id),
    monthly_voice_minutes_limit = coalesce(p_monthly_voice_minutes_limit, monthly_voice_minutes_limit),
    display_name                = coalesce(p_display_name, display_name),
    is_active                   = coalesce(p_is_active, is_active)
  where id = p_plan_id;
end;
$$;

revoke all on function public.admin_update_plan (text, text, int, text, boolean) from public;
grant execute on function public.admin_update_plan (text, text, int, text, boolean) to authenticated;
