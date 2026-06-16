import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.3.1";

const FREE_TIER_MINUTES = 120;

type PlanRow = {
  id: string;
  monthly_voice_minutes_limit: number;
};

async function planFromPriceId(
  admin: SupabaseClient,
  priceId: string | null | undefined,
): Promise<PlanRow> {
  if (!priceId) {
    return { id: "free", monthly_voice_minutes_limit: FREE_TIER_MINUTES };
  }
  const { data } = await admin
    .from("plans")
    .select("id, monthly_voice_minutes_limit")
    .eq("stripe_price_id", priceId)
    .maybeSingle();
  if (data) return data as PlanRow;
  // Unknown price — default to starter limits so the subscriber still gets paid quota.
  const { data: starter } = await admin
    .from("plans")
    .select("id, monthly_voice_minutes_limit")
    .eq("id", "starter")
    .maybeSingle();
  return (starter as PlanRow | null) ?? {
    id: "starter",
    monthly_voice_minutes_limit: 500,
  };
}

Deno.serve(async (req) => {
  const stripeSecret  = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const serviceKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl   = Deno.env.get("SUPABASE_URL")!;

  if (!stripeSecret || !webhookSecret || !serviceKey) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const stripe = new Stripe(stripeSecret);
  const sig    = req.headers.get("stripe-signature");
  if (!sig) return new Response("No signature", { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, webhookSecret);
  } catch (e) {
    console.error("Webhook signature verification failed", e);
    return new Response("Invalid signature", { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Idempotency guard ──────────────────────────────────────────────────────
  const { data: existing } = await admin
    .from("billing_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let orgIdForEvent: string | null = null;

  try {
    if (event.type === "checkout.session.completed") {
      const session    = event.data.object as Stripe.Checkout.Session;
      const orgId      = session.metadata?.organization_id ?? null;
      const customerId = typeof session.customer === "string"
        ? session.customer
        : (session.customer as Stripe.Customer | null)?.id ?? null;
      const subId      = typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription as Stripe.Subscription | null)?.id ?? null;

      orgIdForEvent = orgId;

      if (orgId && customerId) {
        await admin
          .from("organizations")
          .update({ stripe_customer_id: customerId, subscription_status: "active" })
          .eq("id", orgId);

        if (subId) {
          const sub      = await stripe.subscriptions.retrieve(subId);
          const priceId  = sub.items.data[0]?.price?.id ?? null;
          const plan     = await planFromPriceId(admin, priceId);
          const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

          await admin
            .from("organizations")
            .update({
              plan_name:                   plan.id,
              monthly_voice_minutes_limit: plan.monthly_voice_minutes_limit,
              billing_reset_at:            periodEnd,
            })
            .eq("id", orgId);

          await admin.from("organization_subscriptions").upsert(
            {
              organization_id:        orgId,
              stripe_subscription_id: subId,
              stripe_price_id:        priceId,
              current_period_end:     periodEnd,
              updated_at:             new Date().toISOString(),
            },
            { onConflict: "organization_id" },
          );
        }
      }
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub   = event.data.object as Stripe.Subscription;
      let   orgId = sub.metadata?.organization_id as string | undefined;

      if (!orgId && typeof sub.customer === "string") {
        const { data: orgRow } = await admin
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", sub.customer)
          .maybeSingle();
        orgId = orgRow?.id as string | undefined;
      }

      orgIdForEvent = orgId ?? null;

      if (orgId) {
        const active    = sub.status === "active" || sub.status === "trialing";
        const subStatus = active ? "active"
          : sub.status === "past_due" ? "past_due"
          : "canceled";

        const priceId   = sub.items.data[0]?.price?.id ?? null;
        const plan      = active
          ? await planFromPriceId(admin, priceId)
          : { id: "free", monthly_voice_minutes_limit: FREE_TIER_MINUTES };
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

        await admin
          .from("organizations")
          .update({
            subscription_status:         subStatus,
            plan_name:                   plan.id,
            monthly_voice_minutes_limit: plan.monthly_voice_minutes_limit,
            billing_reset_at:            periodEnd,
          })
          .eq("id", orgId);

        await admin.from("organization_subscriptions").upsert(
          {
            organization_id:        orgId,
            stripe_subscription_id: sub.id,
            stripe_price_id:        priceId,
            current_period_end:     periodEnd,
            updated_at:             new Date().toISOString(),
          },
          { onConflict: "organization_id" },
        );
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice  = event.data.object as Stripe.Invoice;
      const customer = typeof invoice.customer === "string" ? invoice.customer : null;
      if (customer) {
        const { data: orgRow } = await admin
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", customer)
          .maybeSingle();
        if (orgRow?.id) {
          orgIdForEvent = orgRow.id;
          await admin
            .from("organizations")
            .update({ subscription_status: "past_due" })
            .eq("id", orgRow.id);
        }
      }
    }

  } catch (e) {
    console.error("Webhook handler error", e);
    await admin.from("billing_events").insert({
      stripe_event_id: event.id,
      event_type:      event.type,
      organization_id: orgIdForEvent,
      payload:         { error: String(e), event_type: event.type },
    }).then(() => {});
    return new Response("Handler error", { status: 500 });
  }

  await admin.from("billing_events").insert({
    stripe_event_id: event.id,
    event_type:      event.type,
    organization_id: orgIdForEvent,
    payload:         { livemode: event.livemode, created: event.created },
  }).then(() => {});

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
