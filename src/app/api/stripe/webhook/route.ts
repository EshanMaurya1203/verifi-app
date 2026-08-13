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
  const { allowed } = await checkRateLimit(identifier, 120000, 50);
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

  console.log("[Stripe Webhook] Event received:", event.type, event.id);

  // ─── ATOMIC IDEMPOTENCY CLAIM VIA RPC ────────────────────────────────────
  if (event.id) {
    let rpcClaimed = false;

    try {
      const { data: rpcData, error: rpcErr } = await supabaseServer.rpc(
        "process_stripe_webhook",
        {
          p_provider: "stripe",
          p_event_id: event.id,
          p_event_type: event.type,
        }
      );

      if (!rpcErr && rpcData) {
        rpcClaimed = true;
        if (rpcData.duplicate) {
          return NextResponse.json({ received: true, duplicate: true });
        }
      }
    } catch {
      rpcClaimed = false;
    }

    if (!rpcClaimed) {
      const { error: claimError } = await supabaseServer
        .from("processed_webhook_events")
        .insert({
          provider: "stripe",
          event_id: event.id,
          event_type: event.type,
        });

      if (claimError) {
        if (
          claimError.code === "23505" ||
          claimError.message?.toLowerCase().includes("duplicate") ||
          claimError.details?.toLowerCase().includes("already exists")
        ) {
          return NextResponse.json({ received: true, duplicate: true });
        }
        console.error("[Stripe Webhook] Failed to claim event:", claimError);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
    }
  }

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

        // Authoritative server-side resolution via provider_account_id ONLY
        const connectedAccountId = (event as Stripe.Event & { account?: string }).account;
        if (!connectedAccountId) {
          console.warn("[Stripe Webhook] Missing event.account on payment_intent.succeeded");
          return NextResponse.json({ received: true, skipped: "unmapped_provider_account" });
        }

        const { data: connection } = await supabaseServer
          .from("provider_connections")
          .select("startup_id")
          .eq("provider_account_id", connectedAccountId)
          .eq("provider", "stripe")
          .eq("status", "connected")
          .maybeSingle();

        const startupId = connection?.startup_id ? Number(connection.startup_id) : null;

        if (!startupId) {
          console.warn("[Stripe Webhook] Unmapped provider_account_id:", connectedAccountId);
          return NextResponse.json({ received: true, skipped: "unmapped_provider_account" });
        }

        // Single-Transaction RPC Call for Stripe Payment
        try {
          const { data: rpcRes, error: rpcErr } = await supabaseServer.rpc(
            "process_stripe_payment_webhook",
            {
              p_provider: "stripe",
              p_event_id: event.id,
              p_event_type: event.type,
              p_startup_id: startupId,
              p_amount: amount,
              p_payment_id: payment.id,
              p_account_id: connectedAccountId,
            }
          );

          if (!rpcErr && rpcRes) {
            if (rpcRes.duplicate) {
              return NextResponse.json({ received: true, duplicate: true });
            }
            if (rpcRes.error) {
              return NextResponse.json({ received: true, skipped: rpcRes.error });
            }
            break;
          }
        } catch {
          // Fallback to updateRevenueAndSnapshot if RPC not deployed yet
        }

        await updateRevenueAndSnapshot(startupId, amount, "stripe", payment.id, connectedAccountId);
        break;
      }

      // ─── Legacy: account onboarding ──────────────────────────
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const connectedAccountId = account.id;

        if (!connectedAccountId) {
          console.warn("[Stripe Webhook] Missing account.id on account.updated");
          return NextResponse.json({ received: true, skipped: "unmapped_provider_account" });
        }

        // Authoritative resolution via provider_connections ONLY
        const { data: connection } = await supabaseServer
          .from("provider_connections")
          .select("startup_id")
          .eq("provider_account_id", connectedAccountId)
          .eq("provider", "stripe")
          .eq("status", "connected")
          .maybeSingle();

        const startupId = connection?.startup_id ? Number(connection.startup_id) : null;

        if (!startupId) {
          console.warn("[Stripe Webhook] Unmapped provider_account_id on account.updated:", connectedAccountId);
          return NextResponse.json({ received: true, skipped: "unmapped_provider_account" });
        }

        if (account.details_submitted) {
          // Single-Transaction RPC Call for Stripe Account Onboarding
          try {
            const { data: rpcRes, error: rpcErr } = await supabaseServer.rpc(
              "process_stripe_account_webhook",
              {
                p_provider: "stripe",
                p_event_id: event.id,
                p_event_type: event.type,
                p_startup_id: startupId,
                p_account_id: connectedAccountId,
                p_api_key_encrypted: encrypt("stripe_connect"),
              }
            );

            if (!rpcErr && rpcRes) {
              if (rpcRes.duplicate) {
                return NextResponse.json({ received: true, duplicate: true });
              }
              if (rpcRes.error) {
                return NextResponse.json({ received: true, skipped: rpcRes.error });
              }
              break;
            }
          } catch {
            // Fallback if RPC not deployed
          }

          // Always set connection fields; only promote status from pre-verified states
          await supabaseServer
            .from("startup_submissions")
            .update({
              stripe_account_id: connectedAccountId,
              payment_connected: true,
            })
            .eq("id", startupId);

          await supabaseServer
            .from("startup_submissions")
            .update({ verification_status: "stripe_connected" })
            .eq("id", startupId)
            .in("verification_status", ["pending", "syncing", "unverified"]);
        }
        break;
      }

      // ─── Legacy: charge tracking (backup) ────────────────────
      case "charge.succeeded": {
        const charge = event.data.object as Stripe.Charge;
        const connectedAccountId = (event as Stripe.Event & { account?: string }).account;
        if (!connectedAccountId) {
          console.warn("[Stripe Webhook] Missing event.account on charge.succeeded");
          return NextResponse.json({ received: true, skipped: "unmapped_provider_account" });
        }

        const { data: connection } = await supabaseServer
          .from("provider_connections")
          .select("startup_id")
          .eq("provider_account_id", connectedAccountId)
          .eq("provider", "stripe")
          .eq("status", "connected")
          .maybeSingle();

        const startupId = connection?.startup_id ? Number(connection.startup_id) : null;

        if (startupId) {
          const chargeAmount = charge.amount / 100;
          try {
            const { data: rpcRes, error: rpcErr } = await supabaseServer.rpc(
              "process_stripe_payment_webhook",
              {
                p_provider: "stripe",
                p_event_id: event.id,
                p_event_type: event.type,
                p_startup_id: startupId,
                p_amount: chargeAmount,
                p_payment_id: charge.id,
                p_account_id: connectedAccountId,
              }
            );

            if (!rpcErr && rpcRes) {
              if (rpcRes.duplicate) {
                return NextResponse.json({ received: true, duplicate: true });
              }
              if (rpcRes.error) {
                return NextResponse.json({ received: true, skipped: rpcRes.error });
              }
              break;
            }
          } catch {
            // Fallback if RPC not deployed
          }

          await updateRevenueAndSnapshot(
            startupId,
            chargeAmount,
            "stripe",
            charge.id,
            connectedAccountId
          );
        } else {
          return NextResponse.json({ received: true, skipped: "unmapped_provider_account" });
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
