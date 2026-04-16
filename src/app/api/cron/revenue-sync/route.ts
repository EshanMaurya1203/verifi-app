import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  // Security Check (e.g. Vercel Cron Secret)
  const authHeader = req.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 1. Fetch all active payment connections
    const { data: connections, error } = await supabaseAdmin
      .from("payment_connections")
      .select("startup_id, provider")
      .eq("is_active", true);

    if (error) throw error;

    const results = {
      total: connections?.length || 0,
      successCount: 0,
      failureCount: 0,
      details: [] as any[]
    };

    // 2. Process each connection
    // We use a simple loop to avoid race conditions on same-table updates if they happen
    for (const conn of connections || []) {
      try {
        // Use the internal sync API logic
        // We'll call the /api/razorpay/sync API relative or just perform the logic.
        // For simplicity and reuse, we call the sync endpoint internally via fetch
        // (Note: in a serverless env, calling your own API over HTTP is standard but watch timeouts)
        
        const syncUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/${conn.provider}/sync`;
        
        const res = await fetch(syncUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startup_id: conn.startup_id })
        });

        if (res.ok) {
          // --- Trigger Integrity Checks ---
          const { detectFraud } = await import("@/lib/fraud");
          await detectFraud(conn.startup_id);
          
          results.successCount++;
        } else {
          results.failureCount++;
          const errData = await res.json();
          results.details.push({ id: conn.startup_id, error: errData.error });
        }

      } catch (connErr: any) {
        results.failureCount++;
        results.details.push({ id: conn.startup_id, error: connErr.message });
      }
    }

    return NextResponse.json({
      success: true,
      summary: results
    });

  } catch (err: any) {
    console.error("Cron Revenue Sync Failure:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
