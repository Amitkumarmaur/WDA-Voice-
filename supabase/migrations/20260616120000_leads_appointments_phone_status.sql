-- Adds phone + status columns to leads and appointments so the client/Edge code
-- (BusinessService, LeadsPanel, AppointmentsPanel) writes/reads the columns it
-- has always referenced. Refreshes the public RPCs to accept p_phone as well.

alter table public.leads
  add column if not exists phone text,
  add column if not exists status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'converted', 'lost'));

alter table public.appointments
  add column if not exists phone text,
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'completed'));

create index if not exists idx_leads_org_status on public.leads (organization_id, status);
create index if not exists idx_appointments_org_status on public.appointments (organization_id, status);

-- Refresh public RPCs to accept phone (kept backwards-compatible with default null).
create or replace function public.capture_public_lead (
  p_slug text,
  p_name text,
  p_email text,
  p_interest text default null,
  p_conversation_id text default null,
  p_phone text default null
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
  insert into public.leads (organization_id, name, email, phone, interest, conversation_id)
    values (v_org, p_name, p_email, p_phone, p_interest, p_conversation_id)
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.capture_public_lead (text, text, text, text, text, text) to anon, authenticated;

create or replace function public.schedule_public_appointment (
  p_slug text,
  p_name text,
  p_email text,
  p_date timestamptz,
  p_notes text default null,
  p_phone text default null
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
  insert into public.appointments (organization_id, name, email, phone, date, notes)
    values (v_org, p_name, p_email, p_phone, p_date, p_notes)
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.schedule_public_appointment (text, text, text, timestamptz, text, text) to anon, authenticated;
