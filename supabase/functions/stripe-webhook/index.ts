import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.3.1";

Deno.serve(async (req) => {
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (!stripeSecret || !webhookSecret || !serviceKey) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const stripe = new Stripe(stripeSecret);
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("No signature", { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, webhookSecret);
  } catch (e) {
    console.error(e);
    return new Response("Invalid signature", { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.organization_id;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;

      if (orgId && customerId) {
        await admin
          .from("organizations")
          .update({
            stripe_customer_id: customerId,
            subscription_status: "active",
          })
          .eq("id", orgId);

        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await admin.from("organization_subscriptions").upsert(
            {
              organization_id: orgId,
              stripe_subscription_id: subId,
              stripe_price_id: sub.items.data[0]?.price?.id ?? null,
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "organization_id" },
          );
        }
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      let orgId = sub.metadata?.organization_id as string | undefined;
      if (!orgId && typeof sub.customer === "string") {
        const { data: orgRow } = await admin
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", sub.customer)
          .maybeSingle();
        orgId = orgRow?.id as string | undefined;
      }
      if (orgId) {
        const active = sub.status === "active" || sub.status === "trialing";
        await admin
          .from("organizations")
          .update({
            subscription_status: active ? "active" : sub.status === "past_due" ? "past_due" : "canceled",
          })
          .eq("id", orgId);

        await admin.from("organization_subscriptions").upsert(
          {
            organization_id: orgId,
            stripe_subscription_id: sub.id,
            stripe_price_id: sub.items.data[0]?.price?.id ?? null,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id" },
        );
      }
    }
  } catch (e) {
    console.error(e);
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
