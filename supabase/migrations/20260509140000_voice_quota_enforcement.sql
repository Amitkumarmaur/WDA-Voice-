-- Voice quota accounting + RPCs used by the client and Edge Functions.

alter table public.transcripts
  add column if not exists duration_seconds integer;

-- Ledger rows (dedupe by transcript when present).
create table if not exists public.voice_usage_events (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  transcript_id uuid references public.transcripts (id) on delete set null,
  duration_seconds integer not null check (duration_seconds > 0),
  created_at timestamptz not null default now ()
);

create unique index if not exists voice_usage_events_transcript_key
  on public.voice_usage_events (transcript_id)
  where transcript_id is not null;

alter table public.voice_usage_events enable row level security;

-- No direct reads/writes; security definer RPCs below own inserts.

drop function if exists public.save_public_transcript (text, jsonb);

create or replace function public.save_public_transcript (
  p_slug text,
  p_messages jsonb,
  p_duration_seconds integer default null
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
  insert into public.transcripts (organization_id, messages, duration_seconds)
    values (v_org, p_messages, p_duration_seconds)
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.save_public_transcript (text, jsonb, integer) to anon, authenticated;

create or replace function public.log_voice_usage (
  p_organization_id uuid,
  p_transcript_id uuid,
  p_duration_seconds integer
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  mins numeric;
  v_inserted int;
begin
  if p_organization_id is null or p_duration_seconds is null or p_duration_seconds <= 0 then
    return;
  end if;

  if auth.uid () is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not public.is_org_member (p_organization_id) then
    raise exception 'not_org_member' using errcode = '42501';
  end if;

  mins := (p_duration_seconds::numeric / 60.0);

  if p_transcript_id is not null then
    insert into public.voice_usage_events (organization_id, transcript_id, duration_seconds)
      values (p_organization_id, p_transcript_id, p_duration_seconds)
    on conflict (transcript_id) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
      return;
    end if;
  else
    insert into public.voice_usage_events (organization_id, transcript_id, duration_seconds)
      values (p_organization_id, null, p_duration_seconds);
  end if;

  update public.organizations
    set monthly_voice_minutes_used = monthly_voice_minutes_used + mins
    where id = p_organization_id;
end;
$$;

revoke all on function public.log_voice_usage (uuid, uuid, integer) from public;
grant execute on function public.log_voice_usage (uuid, uuid, integer) to authenticated;

create or replace function public.log_public_voice_usage (
  p_slug text,
  p_transcript_id uuid,
  p_duration_seconds integer
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_org uuid;
  mins numeric;
  v_inserted int;
begin
  if p_slug is null or trim(p_slug) = '' then
    raise exception 'invalid_slug';
  end if;

  if p_transcript_id is null or p_duration_seconds is null or p_duration_seconds <= 0 then
    return;
  end if;

  select id into v_org from public.organizations where public_slug = p_slug limit 1;
  if v_org is null then
    raise exception 'invalid_slug';
  end if;

  if not exists (
    select 1
    from public.transcripts t
    where t.id = p_transcript_id
      and t.organization_id = v_org
  ) then
    raise exception 'invalid_transcript' using errcode = '42501';
  end if;

  mins := (p_duration_seconds::numeric / 60.0);

  insert into public.voice_usage_events (organization_id, transcript_id, duration_seconds)
    values (v_org, p_transcript_id, p_duration_seconds)
  on conflict (transcript_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return;
  end if;

  update public.organizations
    set monthly_voice_minutes_used = monthly_voice_minutes_used + mins
    where id = v_org;
end;
$$;

revoke all on function public.log_public_voice_usage (text, uuid, integer) from public;
grant execute on function public.log_public_voice_usage (text, uuid, integer) to anon, authenticated;
