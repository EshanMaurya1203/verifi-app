import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia" as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Handle the event
  try {
    switch (event.type) {
      case "account.updated":
        const account = event.data.object as Stripe.Account;
        const startupId = account.metadata?.startupId;

        if (startupId && account.details_submitted) {
          // Update startup status to 'connected' or 'verified'
          await supabaseAdmin
            .from("startup_submissions")
            .update({ 
               verification_status: "stripe_connected",
               verification_label: "Stripe Verified"
            })
            .eq("id", startupId);
          
          console.log(`Startup ${startupId} Stripe account ${account.id} is now fully onboarded.`);
        }
        break;

      case "charge.succeeded":
        const charge = event.data.object as Stripe.Charge;
        const connectedAccountId = event.account; // The ID of the connected account
        
        // Find the startup matching this connected account
        const { data: connection } = await supabaseAdmin
          .from("provider_connections")
          .select("startup_id")
          .eq("account_id", connectedAccountId)
          .single();

        if (connection?.startup_id) {
          await supabaseAdmin.from("revenue_transactions").upsert({
            startup_id: connection.startup_id,
            provider: "stripe",
            amount: charge.amount, // stored in cents
            currency: charge.currency.toUpperCase(),
            status: charge.status,
            external_id: charge.id,
            created_at: new Date(charge.created * 1000).toISOString(),
          }, { onConflict: "external_id" });
        }
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Webhook Error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

