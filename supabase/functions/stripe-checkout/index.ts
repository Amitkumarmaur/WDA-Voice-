import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.3.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    const priceId = Deno.env.get("STRIPE_PRICE_ID");
    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:3000";

    if (!stripeSecret) {
      return Response.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500, headers: cors });
    }
    const stripe = new Stripe(stripeSecret);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
    }

    const { data: mem } = await supabase
      .from("organization_members")
      .select("organization_id, organizations(stripe_customer_id, public_slug)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!mem?.organization_id) {
      return Response.json({ error: "No organization" }, { status: 403, headers: cors });
    }

    const rawOrg = mem.organizations as { stripe_customer_id: string | null; public_slug: string } | null | undefined;
    const org = Array.isArray(rawOrg) ? rawOrg[0] : rawOrg;
    const body = await req.json().catch(() => ({})) as { mode?: string };

    if (body.mode === "portal") {
      const customerId = org?.stripe_customer_id;
      if (!customerId) {
        return Response.json({ error: "No billing account yet" }, { status: 400, headers: cors });
      }
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${siteUrl}/`,
      });
      return Response.json({ url: portal.url }, { headers: cors });
    }

    if (!priceId) {
      return Response.json({ error: "Missing STRIPE_PRICE_ID" }, { status: 500, headers: cors });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: org?.stripe_customer_id ? undefined : user.email,
      customer: org?.stripe_customer_id ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/?checkout=success`,
      cancel_url: `${siteUrl}/?checkout=cancel`,
      metadata: {
        organization_id: mem.organization_id,
        supabase_user_id: user.id,
      },
      subscription_data: {
        metadata: { organization_id: mem.organization_id },
      },
    });

    return Response.json({ url: session.url }, { headers: cors });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500, headers: cors });
  }
});
