import { NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'fake_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'fake_secret',
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    
    // Razorpay Connect Verification Simulation
    // Since Razorpay doesn't have an 'express account' equivalence like Stripe,
    // we initiate the flow by creating a verified contact representing the startup entity.
    
    const contact = await razorpay.contacts.create({
      name: body.founder_name || "Startup Founder",
      email: body.email || "verify@startup.com",
      type: "customer",
      reference_id: `startup_${body.id || Date.now()}`,
      notes: {
        purpose: "Verification Protocol Onboarding"
      }
    });

    return NextResponse.json({
      success: true,
      contact_id: contact.id,
      message: "Razorpay identity created. Signal ready for revenue audit.",
    });

  } catch (err: any) {
    console.error("Razorpay Error:", err);
    // Graceful fallback for demo/invalid credentials
    if (err.statusCode === 401) {
      return NextResponse.json({ 
        error: "Invalid Razorpay Keys. Please check your .env.local file." 
      }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create Razorpay identity" }, { status: 500 });
  }
}
