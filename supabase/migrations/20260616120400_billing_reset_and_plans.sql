-- Fix #1 (real bug): monthly usage reset was unreachable because billing_reset_at
-- was never initialized and the WHERE clause excluded free tier.
-- Fix #2 (config): replace hard-coded PRICE_TO_PLAN map in stripe-webhook with a
-- plans table keyed by stripe_price_id so adding/changing plans is data, not code.
-- Schedules nightly reset via pg_cron so the Edge Function stays a manual safety valve.

-- ---------------------------------------------------------------------------
-- 1. plans: data-driven Stripe price → plan mapping
-- ---------------------------------------------------------------------------

create table if not exists public.plans (
  id text primary key,
  display_name text not null,
  stripe_price_id text unique,
  monthly_voice_minutes_limit integer not null default 120,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.plans (id, display_name, stripe_price_id, monthly_voice_minutes_limit, sort_order)
values
  ('free',       'Free',       null, 120,   0),
  ('starter',    'Starter',    null, 500,   1),
  ('pro',        'Pro',        null, 2000,  2),
  ('enterprise', 'Enterprise', null, 10000, 3)
on conflict (id) do nothing;

alter table public.plans enable row level security;

-- Public catalog: anyone can read active plans (pricing page).
create policy plans_select_public on public.plans
  for select to anon, authenticated
  using (is_active = true);

-- Writes restricted to service_role (Stripe webhook / admin SQL only).
revoke insert, update, delete on public.plans from anon, authenticated;
grant all on public.plans to service_role;

comment on table public.plans is
  'Plan catalog. stripe_price_id is set manually (or via Stripe sync) once live; stripe-webhook joins on it to set monthly_voice_minutes_limit.';

-- ---------------------------------------------------------------------------
-- 2. Initialize billing_reset_at for existing orgs
-- Anchor each org one full month from now so usage windows are predictable.
-- ---------------------------------------------------------------------------

update public.organizations
set billing_reset_at = date_trunc('day', now()) + interval '1 month'
where billing_reset_at is null;

-- ---------------------------------------------------------------------------
-- 3. handle_new_user(): set billing_reset_at on every new signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user ()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  new_org uuid;
  display_name text;
  v_full_name text;
  v_avatar text;
begin
  v_full_name := nullif(
    trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')),
    ''
  );
  display_name := coalesce(v_full_name, split_part(coalesce(new.email, ''), '@', 1), 'My');
  v_avatar := nullif(
    trim(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', '')),
    ''
  );

  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(v_full_name, split_part(coalesce(new.email, ''), '@', 1), 'My'),
    v_avatar
  );

  insert into public.organizations (name, billing_reset_at)
    values (display_name || ' workspace', date_trunc('day', now()) + interval '1 month')
  returning id into new_org;

  insert into public.organization_members (organization_id, user_id, role)
    values (new_org, new.id, 'owner');

  insert into public.agent_settings (organization_id, intro, persona_id, language)
    values (new_org, '', '', 'english');

  return new;
end;
$$;

revoke all on function public.handle_new_user () from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. ensure_my_organization(): same initialization for the fallback path
-- ---------------------------------------------------------------------------

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

  insert into public.profiles (id, email, full_name, avatar_url)
  select
    u.id,
    coalesce(u.email, ''),
    coalesce(
      nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')), ''),
      split_part(coalesce(u.email, ''), '@', 1),
      'My'
    ),
    nullif(
      trim(coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture', '')),
      ''
    )
  from auth.users u
  where u.id = v_uid
  on conflict (id) do nothing;

  select organization_id into v_org
  from public.organization_members
  where user_id = v_uid
  limit 1;

  if v_org is not null then
    return v_org;
  end if;

  insert into public.organizations (name, billing_reset_at)
    values ('My workspace', date_trunc('day', now()) + interval '1 month')
  returning id into v_org;

  insert into public.organization_members (organization_id, user_id, role)
    values (v_org, v_uid, 'owner');

  insert into public.agent_settings (organization_id, intro, persona_id, language)
    values (v_org, '', '', 'english')
  on conflict (organization_id) do nothing;

  return v_org;
end;
$$;

revoke all on function public.ensure_my_organization () from anon;
grant execute on function public.ensure_my_organization () to authenticated;

-- ---------------------------------------------------------------------------
-- 5. reset_monthly_usage(): include free tier; advance reset date even when
-- multiple cycles have lapsed.
-- ---------------------------------------------------------------------------

create or replace function public.reset_monthly_usage()
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_count integer := 0;
  v_now timestamptz := now();
begin
  -- Bring any org whose reset date has passed up to the next future anchor.
  -- Looping advance handles orgs whose reset_at is multiple periods behind
  -- (e.g. cron paused for a few months).
  update public.organizations
  set
    monthly_voice_minutes_used = 0,
    billing_reset_at =
      v_now
      + ((extract(epoch from (interval '1 month'))::bigint)
         - (extract(epoch from (v_now - billing_reset_at))::bigint % extract(epoch from (interval '1 month'))::bigint))
        * interval '1 second'
  where billing_reset_at is not null
    and billing_reset_at <= v_now;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.reset_monthly_usage() from public, anon, authenticated;
grant execute on function public.reset_monthly_usage() to service_role;

-- ---------------------------------------------------------------------------
-- 6. pg_cron: run reset daily at 00:05 UTC.
-- pg_cron is preinstalled on Supabase; the postgres role runs migrations.
-- If pg_cron is not enabled on this project, the CREATE EXTENSION is idempotent
-- and the cron.schedule call deduplicates by jobname.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;

-- Drop any prior schedule with the same name so re-running this migration is safe.
do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'reset-monthly-usage';
exception when others then
  -- pg_cron may be unavailable in some environments (e.g. local Supabase without
  -- the extension allow-listed). Tolerate that — the Edge Function still works.
  raise notice 'pg_cron unavailable, skipping schedule: %', sqlerrm;
end;
$$;

do $$
begin
  perform cron.schedule(
    'reset-monthly-usage',
    '5 0 * * *',
    $cron$ select public.reset_monthly_usage(); $cron$
  );
exception when others then
  raise notice 'pg_cron schedule skipped: %', sqlerrm;
end;
$$;
