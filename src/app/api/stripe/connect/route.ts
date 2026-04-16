import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia" as any,
});

export async function POST(req: Request) {
  try {
    const { startup_id, country, email } = await req.json();
    
    if (!startup_id || !country) {
      return NextResponse.json({ error: "Missing startup_id or country" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // 1. Create an Express Connect Account
    // This allows for better UX and managed onboarding
    const account = await stripe.accounts.create({
      type: "express",
      country: country, // e.g. "US", "GB", "IN"
      email: email,
      capabilities: {
        transfers: { requested: true },
      },
      metadata: { startup_id: String(startup_id) },
    });

    // 2. Persist Stripe ID and Country
    const { error: updateError } = await supabaseAdmin
      .from("startup_submissions")
      .update({ 
        stripe_account_id: account.id,
        country: country 
      })
      .eq("id", startup_id);

    if (updateError) throw updateError;

    // 3. Create Account Link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${baseUrl}/startup/${startup_id}?refresh=true`,
      return_url: `${baseUrl}/startup/${startup_id}?success=true`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });

  } catch (err: any) {
    console.error("Stripe Express API Failure:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
