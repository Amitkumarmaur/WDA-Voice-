-- Add Twilio phone number assignment to organizations
alter table public.organizations
  add column if not exists twilio_phone_number text;

-- Index for fast lookup when Twilio webhook arrives with a phone number
create index if not exists idx_organizations_twilio_phone
  on public.organizations (twilio_phone_number)
  where twilio_phone_number is not null;

-- Allow org owners to update their phone number assignment
-- (the existing organizations_update_owner policy already covers this)
