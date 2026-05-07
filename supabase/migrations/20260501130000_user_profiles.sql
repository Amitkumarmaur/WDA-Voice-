-- User profiles: denormalized name/email/avatar from auth for easy querying in public schema.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_email on public.profiles (lower(email));
create index idx_profiles_created_at on public.profiles (created_at desc);

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- New signups: profile row + workspace (replaces handle_new_user body)
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

-- ---------------------------------------------------------------------------
-- Keep profile in sync when email or OAuth metadata changes
-- ---------------------------------------------------------------------------

create or replace function public.handle_auth_user_updated ()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_full text;
  v_avatar text;
  v_fn text;
begin
  v_full := nullif(
    trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')),
    ''
  );
  v_avatar := nullif(
    trim(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', '')),
    ''
  );
  v_fn := coalesce(v_full, split_part(coalesce(new.email, ''), '@', 1), 'My');

  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    v_fn,
    v_avatar
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = coalesce(nullif(excluded.avatar_url, ''), profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row
  execute function public.handle_auth_user_updated ();

-- ---------------------------------------------------------------------------
-- Backfill users created before this migration
-- ---------------------------------------------------------------------------

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
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ---------------------------------------------------------------------------
-- ensure_my_organization: create missing profile if trigger never ran
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
