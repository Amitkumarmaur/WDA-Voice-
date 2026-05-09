import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { GoogleGenAI } from "npm:@google/genai";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Block Live token when monthly_voice_minutes_used >= monthly_voice_minutes_limit (per organization). */
async function voiceQuotaBlockResponse(
  admin: SupabaseClient,
  orgId: string,
): Promise<Response | null> {
  const { data: org, error } = await admin
    .from("organizations")
    .select("monthly_voice_minutes_used, monthly_voice_minutes_limit")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !org) {
    return Response.json({ error: "Organization not found", code: "org_not_found" }, { status: 404, headers: cors });
  }
  const used = Number(org.monthly_voice_minutes_used ?? 0);
  const limit = Number(org.monthly_voice_minutes_limit ?? 0);
  if (used >= limit) {
    return Response.json(
      {
        error:
          "Monthly voice minutes quota reached for this workspace. Upgrade or wait until usage resets.",
        code: "voice_quota_exceeded",
      },
      { status: 402, headers: cors },
    );
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return Response.json({ error: "Server missing GEMINI_API_KEY" }, { status: 500, headers: cors });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    let orgId: string | null = null;
    if (user) {
      const { data: mem } = await supabaseUser
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      orgId = mem?.organization_id ?? null;
    } else {
      const body = await req.json().catch(() => ({})) as { public_slug?: string };
      if (!body.public_slug) {
        return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
      }
      const { data: slugOrg } = await supabaseUser.rpc("resolve_org_by_public_slug", {
        p_slug: body.public_slug,
      });
      orgId = slugOrg as string | null;
      if (!orgId) {
        return Response.json({ error: "Invalid embed" }, { status: 404, headers: cors });
      }
    }

    if (!orgId) {
      return Response.json({ error: "No organization" }, { status: 403, headers: cors });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const blocked = await voiceQuotaBlockResponse(admin, orgId);
      if (blocked) return blocked;
    } else {
      console.warn("gemini-live-token: SUPABASE_SERVICE_ROLE_KEY unset; voice quota not enforced");
    }

    const client = new GoogleGenAI({ apiKey: geminiKey });
    // Short-lived browser tokens: limit blast radius if a token leaks (never ship API keys to the client).
    const expireTime = new Date(Date.now() + 12 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(Date.now() + 90 * 1000).toISOString();

    // uses: 1 breaks dev flows (Fast Refresh / remounts open Live twice) and can surface as WS 1011.
    // Still bounded by expireTime; tighten with env if you need strict single-use in production.
    const token = await client.authTokens.create({
      config: {
        uses: 0,
        expireTime,
        newSessionExpireTime,
        httpOptions: { apiVersion: "v1alpha" },
      },
    });

    const name = token.name;
    if (!name) {
      return Response.json({ error: "Token provisioning failed" }, { status: 500, headers: cors });
    }

    return Response.json({ apiKey: name, organizationId: orgId }, { headers: cors });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500, headers: cors });
  }
});
