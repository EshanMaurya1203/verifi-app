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
            }
          );

          if (!rpcErr && rpcRes) {
            if (rpcRes.duplicate) {
              return NextResponse.json({ received: true, duplicate: true });
            }
            break;
          }
        } catch {
          // Fallback to updateRevenueAndSnapshot if RPC not deployed yet
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
            // Single-Transaction RPC Call for Stripe Account Onboarding
            try {
              const { data: rpcRes, error: rpcErr } = await supabaseServer.rpc(
                "process_stripe_account_webhook",
                {
                  p_provider: "stripe",
                  p_event_id: event.id,
                  p_event_type: event.type,
                  p_startup_id: startupId,
                  p_account_id: account.id,
                  p_api_key_encrypted: encrypt("stripe_connect"),
                }
              );

              if (!rpcErr && rpcRes) {
                if (rpcRes.duplicate) {
                  return NextResponse.json({ received: true, duplicate: true });
                }
                break;
              }
            } catch {
              // Fallback if RPC not deployed
            }

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
          try {
            const { data: rpcRes, error: rpcErr } = await supabaseServer.rpc(
              "process_stripe_payment_webhook",
              {
                p_provider: "stripe",
                p_event_id: event.id,
                p_event_type: event.type,
                p_startup_id: connection.startup_id,
                p_amount: chargeAmount,
                p_payment_id: charge.id,
              }
            );

            if (!rpcErr && rpcRes) {
              if (rpcRes.duplicate) {
                return NextResponse.json({ received: true, duplicate: true });
              }
              break;
            }
          } catch {
            // Fallback if RPC not deployed
          }

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
