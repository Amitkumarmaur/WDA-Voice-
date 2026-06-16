import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimStr(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t.length > max ? t.slice(0, max) : t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  }

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!serviceKey || !supabaseUrl) {
      return Response.json({ error: "Server configuration error" }, { status: 500, headers: cors });
    }

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) {
      return Response.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
    }

    // Honeypot: silently accept bots to avoid giving hints
    const trap = typeof body.website === "string" ? body.website.trim() : "";
    if (trap.length > 0) {
      return Response.json({ ok: true }, { status: 200, headers: cors });
    }

    const name = trimStr(body.name, 200);
    const email = trimStr(body.email, 320).toLowerCase();
    const company = trimStr(body.company, 200);
    const message = trimStr(body.message, 5000);

    if (name.length < 1 || message.length < 1 || email.length < 3) {
      return Response.json({ error: "Name, email, and message are required" }, { status: 400, headers: cors });
    }
    if (!EMAIL_RE.test(email)) {
      return Response.json({ error: "Invalid email" }, { status: 400, headers: cors });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: insErr } = await admin.from("contact_submissions").insert({
      name,
      email,
      company: company || null,
      message,
    });

    if (insErr) {
      console.error("contact_submissions insert", insErr);
      return Response.json({ error: "Could not save message" }, { status: 500, headers: cors });
    }

    return Response.json({ ok: true }, { status: 200, headers: cors });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Unexpected error" }, { status: 500, headers: cors });
  }
});
