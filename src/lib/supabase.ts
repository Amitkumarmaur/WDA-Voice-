import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
const projectRef = url?.match(/https:\/\/([^.]+)\.supabase\.co/i)?.[1];

/** Per-project storage key — avoids PKCE verifier clashes when Supabase project env changes. */
const authStorageKey = projectRef ? `sb-${projectRef}-auth-token` : undefined;

/** Browser-safe check: real keys present (not empty and not .env.example placeholders). */
export function isSupabaseEnvConfigured(): boolean {
  const u = url?.trim() ?? '';
  const a = anon?.trim() ?? '';
  return u.length > 0 && a.length > 0 && !u.includes('YOUR_PROJECT') && !a.includes('YOUR_ANON_KEY');
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!url || !anon) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  }
  if (!client) {
    client = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        ...(authStorageKey ? { storageKey: authStorageKey } : {}),
      },
    });
  }
  return client;
}

export function getSupabaseUrl(): string {
  if (!url) throw new Error('Missing VITE_SUPABASE_URL');
  return url.trim();
}
