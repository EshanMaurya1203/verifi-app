import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabase-server";
import { updateRevenueAndSnapshot } from "@/lib/webhook-handler";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia" as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 50);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("[Stripe Webhook] Event received:", event.type);

  try {
    switch (event.type) {
      // ─── Real-time revenue tracking ──────────────────────────
      case "payment_intent.succeeded": {
        const payment = event.data.object as Stripe.PaymentIntent;
        const amount = payment.amount / 100;
        
        if (amount < 100) {
          console.log("Ignoring micro-payment completely:", amount);
          return new Response("Ignored micro payment", { status: 200 });
        }

        // Try metadata first, then fall back to provider_connections lookup
        let startupId = payment.metadata?.startup_id
          ? Number(payment.metadata.startup_id)
          : null;

        if (!startupId) {
          // Fall back: find startup via connected account
          const connectedAccountId = (event as any).account;
          if (connectedAccountId) {
            const { data: connection } = await supabaseServer
              .from("provider_connections")
              .select("startup_id")
              .eq("account_id", connectedAccountId)
              .eq("provider", "stripe")
              .single();

            startupId = connection?.startup_id ?? null;
          }
        }

        if (!startupId) {
          console.warn("[Stripe Webhook] No startup_id found for payment:", payment.id);
          return NextResponse.json({ received: true, skipped: "no_startup_id" });
        }

        // Also record the raw transaction
        await supabaseServer.from("revenue_transactions").upsert({
          startup_id: startupId,
          provider: "stripe",
          amount: payment.amount, // stored in smallest unit (cents/paise)
          currency: (payment.currency || "usd").toUpperCase(),
          status: payment.status,
          external_id: payment.id,
          created_at: new Date(payment.created * 1000).toISOString(),
        }, { onConflict: "external_id" });

        // 🔥 Real-time revenue + snapshot + trust update
        await updateRevenueAndSnapshot(startupId, amount, "stripe", payment.id);
        break;
      }

      // ─── Legacy: account onboarding ──────────────────────────
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const startupId = account.metadata?.startupId;

        if (startupId && account.details_submitted) {
          await supabaseServer
            .from("startup_submissions")
            .update({
              verification_status: "stripe_connected",
              verification_label: "Stripe Verified",
            })
            .eq("id", startupId);

          console.log(`[Stripe Webhook] Startup ${startupId} onboarded via account ${account.id}`);
        }
        break;
      }

      // ─── Legacy: charge tracking (backup) ────────────────────
      case "charge.succeeded": {
        const charge = event.data.object as Stripe.Charge;
        const connectedAccountId = (event as any).account;

        const { data: connection } = await supabaseServer
          .from("provider_connections")
          .select("startup_id")
          .eq("account_id", connectedAccountId)
          .eq("provider", "stripe")
          .single();

        if (connection?.startup_id) {
          await supabaseServer.from("revenue_transactions").upsert({
            startup_id: connection.startup_id,
            provider: "stripe",
            amount: charge.amount,
            currency: charge.currency.toUpperCase(),
            status: charge.status,
            external_id: charge.id,
            created_at: new Date(charge.created * 1000).toISOString(),
          }, { onConflict: "external_id" });
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Stripe Webhook] Handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
