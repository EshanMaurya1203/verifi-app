import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20", // or whatever the current stable version is
});

export async function POST() {
  try {
    // 1. Create a special "Express" account for the startup
    const account = await stripe.accounts.create({
      type: "express",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // 2. Generate an onboarding link for this specific account
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: "http://localhost:3000/startup",
      return_url: "http://localhost:3000/leaderboard",
      type: "account_onboarding",
    });

    // 3. Return the secure URL to the frontend
    return NextResponse.json({ url: accountLink.url });
  } catch (err: any) {
    console.error("Stripe Connect Error:", err);
    return NextResponse.json({ error: err.message || "Stripe internal error" }, { status: 500 });
  }
}
