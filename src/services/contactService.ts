import { getSupabaseUrl, isSupabaseEnvConfigured } from '../lib/supabase';

export type ContactPayload = {
  name: string;
  email: string;
  company?: string;
  message: string;
  /** Honeypot — must stay empty */
  website?: string;
};

export async function submitContactForm(payload: ContactPayload): Promise<void> {
  if (!isSupabaseEnvConfigured()) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.');
  }
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!anon?.trim()) {
    throw new Error('Missing VITE_SUPABASE_ANON_KEY');
  }

  const url = `${getSupabaseUrl()}/functions/v1/contact-form`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
    },
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      company: payload.company ?? '',
      message: payload.message,
      website: payload.website ?? '',
    }),
  });

  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !json.ok) {
    throw new Error(json.error || 'Something went wrong. Please try again.');
  }
}
