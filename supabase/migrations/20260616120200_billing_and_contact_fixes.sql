-- Fix Edge Function table/column mismatches and add missing Stripe tracking
-- Date: 2026-06-16

-- ---------------------------------------------------------------------------
-- organizations: add plan_name and billing_reset_at columns
-- Used by stripe-webhook to track plan and by reset_monthly_usage to decide when to reset
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column if not exists plan_name text not null default 'free'
    check (plan_name in ('free', 'starter', 'pro', 'enterprise')),
  add column if not exists billing_reset_at timestamptz;

comment on column public.organizations.plan_name is
  'Current subscription plan (free/starter/pro/enterprise); set by Stripe webhook.';

comment on column public.organizations.billing_reset_at is
  'Next date when monthly_voice_minutes_used should be reset; managed by reset_monthly_usage.';

-- ---------------------------------------------------------------------------
-- billing_events: track Stripe webhook events for idempotency
-- stripe-webhook uses this to avoid double-processing the same event
-- ---------------------------------------------------------------------------

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  organization_id uuid references public.organizations (id) on delete set null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_events_org on public.billing_events (organization_id);
create index if not exists idx_billing_events_created on public.billing_events (created_at desc);

alter table public.billing_events enable row level security;

comment on table public.billing_events is
  'Stripe webhook event log; used for idempotency and audit trail.';

-- No RLS policies: service_role only (webhook inserts)
revoke all on public.billing_events from anon, authenticated;
grant all on public.billing_events to service_role;

-- ---------------------------------------------------------------------------
-- contact_submissions: add company column (used by contact-form Edge Function)
-- Also rename table alias or fix Edge Function reference
-- We'll update contact_submissions to match the Edge Function expectation
-- ---------------------------------------------------------------------------

-- If contact-form is meant to use contact_submissions, make sure it has all needed columns
alter table public.contact_submissions
  add column if not exists company text;

comment on column public.contact_submissions.company is
  'Optional company name from contact form.';

-- ---------------------------------------------------------------------------
-- reset_monthly_usage RPC: reset voice usage for orgs past their billing_reset_at
-- Called by reset-monthly-usage Edge Function (and optionally pg_cron daily)
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
  -- Reset usage and advance billing_reset_at for all orgs past their reset date
  update public.organizations
  set
    monthly_voice_minutes_used = 0,
    billing_reset_at = billing_reset_at + interval '1 month'
  where billing_reset_at is not null
    and billing_reset_at <= v_now
    and subscription_status in ('active', 'past_due');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.reset_monthly_usage() is
  'Reset monthly_voice_minutes_used for all orgs past their billing_reset_at. Returns count of orgs reset.';

revoke all on function public.reset_monthly_usage() from public;
grant execute on function public.reset_monthly_usage() to service_role;

-- ---------------------------------------------------------------------------
-- Note: pg_cron setup
-- To automatically reset usage daily, the Supabase project should have:
--   SELECT cron.schedule('reset-monthly-usage', '0 5 * * *', 'SELECT reset_monthly_usage()');
-- This is manually configured in Supabase dashboard → SQL Editor, not in migration.
-- Alternatively, reset-monthly-usage Edge Function can be called via external cron (e.g., cron-job.org).
-- ---------------------------------------------------------------------------
