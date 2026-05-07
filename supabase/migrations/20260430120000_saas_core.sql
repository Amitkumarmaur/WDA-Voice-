-- SaaS core: organizations, members, tenant data, RLS, public RPCs

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My workspace',
  public_slug text not null unique default replace(encode(gen_random_bytes(16), 'hex'), '/', 'x'),
  stripe_customer_id text unique,
  subscription_status text not null default 'free'
    check (subscription_status in ('free', 'active', 'past_due', 'canceled')),
  monthly_voice_minutes_limit integer not null default 120,
  monthly_voice_minutes_used numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner'
    check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.organization_subscriptions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  stripe_subscription_id text,
  stripe_price_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  content text not null,
  source text not null,
  type text not null check (type in ('pdf', 'website', 'manual', 'audio')),
  storage_path text,
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  email text not null,
  interest text,
  conversation_id text,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  email text not null,
  date timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.voice_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text not null,
  tone text not null,
  pace text not null,
  pitch text not null,
  intonation text not null,
  nuances text not null,
  energy_level text not null,
  recommended_voice text not null,
  created_at timestamptz not null default now()
);

create table public.agent_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  intro text not null default '',
  persona_id text not null default '',
  language text not null default 'english' check (language in ('hindi', 'english')),
  updated_at timestamptz not null default now()
);

create index idx_knowledge_items_org on public.knowledge_items (organization_id, created_at desc);
create index idx_leads_org on public.leads (organization_id, created_at desc);
create index idx_appointments_org on public.appointments (organization_id, created_at desc);
create index idx_transcripts_org on public.transcripts (organization_id, created_at desc);
create index idx_voice_profiles_org on public.voice_profiles (organization_id, created_at desc);
create index idx_org_members_user on public.organization_members (user_id);

-- ---------------------------------------------------------------------------
-- New user: workspace + membership + default agent settings
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
begin
  display_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'My');
  insert into public.organizations (name)
    values (display_name || ' workspace')
  returning id into new_org;

  insert into public.organization_members (organization_id, user_id, role)
    values (new_org, new.id, 'owner');

  insert into public.agent_settings (organization_id, intro, persona_id, language)
    values (new_org, '', '', 'english');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user ();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_org_member (org_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid ()
  );
$$;

create or replace function public.resolve_org_by_public_slug (p_slug text)
  returns uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select id
  from public.organizations
  where public_slug = p_slug
  limit 1;
$$;

grant execute on function public.resolve_org_by_public_slug (text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public embed: read-only bundle (no direct table SELECT for anon)
-- ---------------------------------------------------------------------------

create or replace function public.get_public_agent_bundle (p_slug text)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_org uuid;
  v_kb jsonb;
  v_settings jsonb;
  v_voice jsonb;
begin
  select id into v_org
  from public.organizations
  where public_slug = p_slug
  limit 1;

  if v_org is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(t) order by t.created_at desc),
    '[]'::jsonb
  ) into v_kb
  from (
    select id, title, content, source, type, created_at
    from public.knowledge_items
    where organization_id = v_org
  ) t;

  select coalesce(to_jsonb(a) - 'organization_id', '{}'::jsonb) into v_settings
  from public.agent_settings a
  where a.organization_id = v_org;

  select to_jsonb(v) - 'organization_id' into v_voice
  from public.voice_profiles v
  where v.organization_id = v_org
  order by v.created_at desc
  limit 1;

  return jsonb_build_object(
    'organization_id', v_org,
    'public_slug', p_slug,
    'knowledge_items', coalesce(v_kb, '[]'::jsonb),
    'agent_settings', coalesce(v_settings, '{}'::jsonb),
    'voice_profile', v_voice
  );
end;
$$;

grant execute on function public.get_public_agent_bundle (text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public writes (validated by slug; no anon table policies on leads etc.)
-- ---------------------------------------------------------------------------

create or replace function public.capture_public_lead (
  p_slug text,
  p_name text,
  p_email text,
  p_interest text default null,
  p_conversation_id text default null
)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_org uuid;
  new_id uuid;
begin
  select id into v_org from public.organizations where public_slug = p_slug limit 1;
  if v_org is null then
    raise exception 'invalid_slug';
  end if;
  insert into public.leads (organization_id, name, email, interest, conversation_id)
    values (v_org, p_name, p_email, p_interest, p_conversation_id)
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.capture_public_lead (text, text, text, text, text) to anon, authenticated;

create or replace function public.schedule_public_appointment (
  p_slug text,
  p_name text,
  p_email text,
  p_date timestamptz,
  p_notes text default null
)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_org uuid;
  new_id uuid;
begin
  select id into v_org from public.organizations where public_slug = p_slug limit 1;
  if v_org is null then
    raise exception 'invalid_slug';
  end if;
  insert into public.appointments (organization_id, name, email, date, notes)
    values (v_org, p_name, p_email, p_date, p_notes)
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.schedule_public_appointment (text, text, text, timestamptz, text) to anon, authenticated;

create or replace function public.save_public_transcript (p_slug text, p_messages jsonb)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_org uuid;
  new_id uuid;
begin
  select id into v_org from public.organizations where public_slug = p_slug limit 1;
  if v_org is null then
    raise exception 'invalid_slug';
  end if;
  insert into public.transcripts (organization_id, messages)
    values (v_org, p_messages)
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.save_public_transcript (text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.leads enable row level security;
alter table public.appointments enable row level security;
alter table public.transcripts enable row level security;
alter table public.voice_profiles enable row level security;
alter table public.agent_settings enable row level security;

-- Organizations: members can read/update their orgs
create policy organizations_select_member on public.organizations
  for select to authenticated
  using (public.is_org_member (id));

create policy organizations_update_owner on public.organizations
  for update to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid ()
        and m.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid ()
        and m.role in ('owner', 'admin')
    )
  );

-- Members: see own rows
create policy organization_members_select on public.organization_members
  for select to authenticated
  using (user_id = auth.uid ());

create policy organization_members_insert on public.organization_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = organization_members.organization_id
        and m.user_id = auth.uid ()
        and m.role in ('owner', 'admin')
    )
  );

-- Subscriptions: members read; service role / edge uses service key for writes
create policy organization_subscriptions_select on public.organization_subscriptions
  for select to authenticated
  using (public.is_org_member (organization_id));

-- Knowledge
create policy knowledge_items_all on public.knowledge_items
  for all to authenticated
  using (public.is_org_member (organization_id))
  with check (public.is_org_member (organization_id));

-- Leads / appointments / transcripts: members manage
create policy leads_all on public.leads
  for all to authenticated
  using (public.is_org_member (organization_id))
  with check (public.is_org_member (organization_id));

create policy appointments_all on public.appointments
  for all to authenticated
  using (public.is_org_member (organization_id))
  with check (public.is_org_member (organization_id));

create policy transcripts_all on public.transcripts
  for all to authenticated
  using (public.is_org_member (organization_id))
  with check (public.is_org_member (organization_id));

-- Voice profiles
create policy voice_profiles_all on public.voice_profiles
  for all to authenticated
  using (public.is_org_member (organization_id))
  with check (public.is_org_member (organization_id));

-- Agent settings
create policy agent_settings_all on public.agent_settings
  for all to authenticated
  using (public.is_org_member (organization_id))
  with check (public.is_org_member (organization_id));
