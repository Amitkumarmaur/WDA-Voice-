import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * reset-monthly-usage
 *
 * Manually trigger a monthly usage reset for all orgs whose billing_reset_at has passed.
 * This is also handled automatically by pg_cron (daily at 00:05 UTC), so this endpoint
 * is a safety valve for manual ops / re-runs.
 *
 * Must be called with the service role key (admin-only endpoint).
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!serviceKey || !supabaseUrl) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Only allow requests authenticated with the service role key
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token !== serviceKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("reset_monthly_usage");
  if (error) {
    console.error("reset_monthly_usage error", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, orgs_reset: data });
});
