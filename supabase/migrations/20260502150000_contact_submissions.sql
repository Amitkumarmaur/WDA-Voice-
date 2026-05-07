-- Contact form storage (marketing site). Inserts only via Edge Function (service_role).
create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320),
  message text not null check (char_length(message) between 1 and 10000)
);

comment on table public.contact_submissions is 'Voicera marketing contact form; rows inserted by contact-form Edge Function only.';

alter table public.contact_submissions enable row level security;

-- No policies: JWT roles cannot read or write. Service role bypasses RLS for inserts from Edge Functions.

revoke all on public.contact_submissions from anon, authenticated;
grant all on public.contact_submissions to service_role;
