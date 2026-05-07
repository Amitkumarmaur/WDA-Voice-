import { getSupabase, getSupabaseUrl } from '../lib/supabase';

export const BillingService = {
  async createCheckoutSession(): Promise<string> {
    const supabase = getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('Not signed in');
    const url = `${getSupabaseUrl()}/functions/v1/stripe-checkout`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({}),
    });
    const json = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !json.url) {
      throw new Error(json.error || 'Checkout failed');
    }
    return json.url;
  },

  async createPortalSession(): Promise<string> {
    const supabase = getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('Not signed in');
    const url = `${getSupabaseUrl()}/functions/v1/stripe-checkout`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify({ mode: 'portal' }),
    });
    const json = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !json.url) {
      throw new Error(json.error || 'Portal failed');
    }
    return json.url;
  },
};
