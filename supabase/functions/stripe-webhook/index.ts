import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.3.1";

/** Map Stripe price IDs to plan names. Add entries as you create prices in Stripe. */
const PRICE_TO_PLAN: Record<string, string> = {
  // e.g. "price_xxx": "starter",
  //      "price_yyy": "pro",
};

function planFromPriceId(priceId: string | null | undefined): string {
  if (!priceId) return "free";
  return PRICE_TO_PLAN[priceId] ?? "starter";
}

function minutesLimitForPlan(plan: string): number {
  switch (plan) {
    case "starter":    return 500;
    case "pro":        return 2000;
    case "enterprise": return 10000;
    default:           return 120; // free
  }
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
  // If we've already processed this event, return 200 immediately.
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

  // Record the event before processing so a crash on the handler side
  // doesn't allow a replay to double-process.
  let orgIdForEvent: string | null = null;

  try {
    // ── Event handlers ────────────────────────────────────────────────────────

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
          const plan     = planFromPriceId(priceId);

          await admin
            .from("organizations")
            .update({
              plan_name:                     plan,
              monthly_voice_minutes_limit:   minutesLimitForPlan(plan),
            })
            .eq("id", orgId);

          await admin.from("organization_subscriptions").upsert(
            {
              organization_id:       orgId,
              stripe_subscription_id: subId,
              stripe_price_id:       priceId,
              current_period_end:    new Date(sub.current_period_end * 1000).toISOString(),
              updated_at:            new Date().toISOString(),
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
        const active   = sub.status === "active" || sub.status === "trialing";
        const subStatus = active ? "active"
          : sub.status === "past_due" ? "past_due"
          : "canceled";

        const priceId = sub.items.data[0]?.price?.id ?? null;
        const plan    = active ? planFromPriceId(priceId) : "free";

        await admin
          .from("organizations")
          .update({
            subscription_status:           subStatus,
            plan_name:                     plan,
            monthly_voice_minutes_limit:   minutesLimitForPlan(plan),
          })
          .eq("id", orgId);

        await admin.from("organization_subscriptions").upsert(
          {
            organization_id:       orgId,
            stripe_subscription_id: sub.id,
            stripe_price_id:       priceId,
            current_period_end:    new Date(sub.current_period_end * 1000).toISOString(),
            updated_at:            new Date().toISOString(),
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
    // Still record the event as failed so retries don't double-process
    await admin.from("billing_events").insert({
      stripe_event_id: event.id,
      event_type:      event.type,
      organization_id: orgIdForEvent,
      payload:         { error: String(e), event_type: event.type },
    }).then(() => {});
    return new Response("Handler error", { status: 500 });
  }

  // ── Record successful processing ──────────────────────────────────────────
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
