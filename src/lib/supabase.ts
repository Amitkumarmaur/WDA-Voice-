import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
const projectRef = url?.match(/https:\/\/([^.]+)\.supabase\.co/i)?.[1];

/** Per-project storage key — avoids PKCE verifier clashes when Supabase project env changes. */
const authStorageKey = projectRef ? `sb-${projectRef}-auth-token` : undefined;

function jwtProjectRef(key: string): string | null {
  if (!key.startsWith('eyJ')) return null;
  try {
    const payload = key.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { ref?: string };
    return typeof json.ref === 'string' ? json.ref : null;
  } catch {
    return null;
  }
}

/** Detect URL/key from different Supabase projects (causes "Invalid API key" on sign-in). */
export function getSupabaseEnvMismatch(): string | null {
  if (!url || !anon || !projectRef) return null;
  const keyRef = jwtProjectRef(anon);
  if (keyRef && keyRef !== projectRef) {
    return `VITE_SUPABASE_URL points to "${projectRef}" but VITE_SUPABASE_ANON_KEY belongs to "${keyRef}". Use matching values from the same Supabase project (Settings → API).`;
  }
  return null;
}

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
