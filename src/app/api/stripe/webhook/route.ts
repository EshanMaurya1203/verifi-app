import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabase-server";
import { updateRevenueAndSnapshot } from "@/lib/webhook-handler";
import { getPlatformStripe } from "@/lib/stripe";
import { encrypt } from "@/lib/encryption";

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
    const stripe = getPlatformStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe Webhook] Signature verification failed:", errorMsg);
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
          const connectedAccountId = (event as Stripe.Event & { account?: string }).account;
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

        await updateRevenueAndSnapshot(startupId, amount, "stripe", payment.id);
        break;
      }

      // ─── Legacy: account onboarding ──────────────────────────
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const startupIdMeta =
          account.metadata?.startupId ?? account.metadata?.startup_id;

        if (startupIdMeta && account.details_submitted) {
          const startupId = Number(startupIdMeta);
          if (Number.isFinite(startupId)) {
            await supabaseServer.from("provider_connections").upsert(
              {
                startup_id: startupId,
                provider: "stripe",
                account_id: account.id,
                api_key_encrypted: encrypt("stripe_connect"),
                status: "connected",
                last_synced_at: new Date().toISOString(),
              },
              { onConflict: "startup_id,provider" }
            );

            // Always set connection fields; only promote status from pre-verified states
            await supabaseServer
              .from("startup_submissions")
              .update({
                stripe_account_id: account.id,
                payment_connected: true,
              })
              .eq("id", startupId);

            await supabaseServer
              .from("startup_submissions")
              .update({ verification_status: "stripe_connected" })
              .eq("id", startupId)
              .in("verification_status", ["pending", "syncing", "unverified"]);
          }
        }
        break;
      }

      // ─── Legacy: charge tracking (backup) ────────────────────
      case "charge.succeeded": {
        const charge = event.data.object as Stripe.Charge;
        const connectedAccountId = (event as Stripe.Event & { account?: string }).account;

        const { data: connection } = await supabaseServer
          .from("provider_connections")
          .select("startup_id")
          .eq("account_id", connectedAccountId)
          .eq("provider", "stripe")
          .single();

        if (connection?.startup_id) {
          const chargeAmount = charge.amount / 100;
          await updateRevenueAndSnapshot(
            connection.startup_id,
            chargeAmount,
            "stripe",
            charge.id
          );
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Webhook handler failed";
    console.error("[Stripe Webhook] Handler error:", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
