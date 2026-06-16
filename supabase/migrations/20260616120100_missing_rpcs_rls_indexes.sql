-- Critical fixes: missing RPC (resolve_org_by_public_slug), missing RLS policies, missing index
-- Date: 2026-06-16

-- ---------------------------------------------------------------------------
-- MISSING RPC: resolve_org_by_public_slug
-- Used by gemini-live-token and gemini-generate for public embed org lookup
-- Without this, public embeds (anonymous voice agent) will fail
-- ---------------------------------------------------------------------------

create or replace function public.resolve_org_by_public_slug(p_slug text)
  returns uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select id from public.organizations where public_slug = p_slug limit 1;
$$;

comment on function public.resolve_org_by_public_slug(text) is
  'Lookup organization ID by public_slug for public embed access (anon-safe).';

revoke all on function public.resolve_org_by_public_slug(text) from public;
grant execute on function public.resolve_org_by_public_slug(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- MISSING RLS POLICY: agent_settings select
-- Currently any authenticated user can read any org's agent settings (SECURITY BREACH)
-- ---------------------------------------------------------------------------

alter table public.agent_settings enable row level security;

create policy agent_settings_select_member on public.agent_settings
  for select to authenticated
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = agent_settings.organization_id
        and user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- MISSING RLS POLICY: organization_subscriptions select
-- Currently any authenticated user can read any org's subscription/billing (SECURITY BREACH)
-- ---------------------------------------------------------------------------

alter table public.organization_subscriptions enable row level security;

create policy org_subscriptions_select_member on public.organization_subscriptions
  for select to authenticated
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = organization_subscriptions.organization_id
        and user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- MISSING INDEX: organization_members by organization_id
-- Currently only idx_org_members_user exists; lookups by org_id will full-scan
-- This index speeds up: ensure_my_organization, admin queries, org member lists
-- ---------------------------------------------------------------------------

create index if not exists idx_org_members_org on public.organization_members (organization_id);

comment on index idx_org_members_org is
  'Speed up member lookups by organization (e.g., admin queries, membership lists).';
