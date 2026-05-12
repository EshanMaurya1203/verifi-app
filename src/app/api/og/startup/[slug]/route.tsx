import { ImageResponse } from 'next/og';
import { supabaseAdmin } from '@/lib/supabase-server';
import { computeVerificationState } from '@/lib/verification-state';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    
    // 1. Resolve Startup
    let query = supabaseAdmin.from("startup_submissions").select("*");
    if (!isNaN(Number(slug))) {
      query = query.eq("id", Number(slug));
    } else {
      query = query.ilike("startup_name", slug);
    }
    
    const { data: startup, error } = await query.maybeSingle();

    if (error || !startup) {
      return new ImageResponse(
        (
          <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#0a0a0a', color: 'white', justifyContent: 'center', alignItems: 'center' }}>
            <h1>Startup Not Found</h1>
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    const startupId = startup.id;

    // 2. Fetch all verification data
    const [revenueRes, fraudRes, providerRes] = await Promise.all([
      supabaseAdmin
        .from("revenue_transactions")
        .select("amount, created_at")
        .eq("startup_id", startupId)
        .order("created_at", { ascending: true })
        .limit(100),
      supabaseAdmin
        .from("fraud_signals")
        .select("signal_type")
        .eq("startup_id", startupId),
      supabaseAdmin
        .from("provider_connections")
        .select("provider, status, last_synced_at")
        .eq("startup_id", startupId)
        .eq("status", "connected")
    ]);

    const rawRevenue = revenueRes.data || [];
    const revenue = rawRevenue.map(event => ({
      timestamp: new Date(event.created_at).getTime(),
      amount: Number(event.amount) || 0
    }));

    // 3. Compute Engines
    const verificationState = computeVerificationState({
      revenueTransactions: revenue,
      providerConnections: providerRes.data || [],
      fraudSignals: fraudRes.data || [],
      penaltyCount: Number(startup.penalty_count) || 0
    });

    const formatInr = (value: number) => 
      new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

    // Helpers to get styles for Authenticity Level
    let authColor = '#f59e0b'; // Amber-500
    if (verificationState.authenticityLevel === 'Organic') authColor = '#10b981'; // Emerald-500
    if (verificationState.authenticityLevel === 'Suspicious') authColor = '#ef4444'; // Red-500

    let trustColor = '#f59e0b';
    let trustLabel = 'Active Audit';
    if (verificationState.trustScore > 85) { trustColor = '#10b981'; trustLabel = 'Forensic Grade'; }
    else if (verificationState.trustScore > 65) { trustColor = '#6366f1'; trustLabel = 'High Integrity'; }

    // Start OG Image UI construction
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            backgroundColor: '#0a0a0a',
            padding: '80px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Top Row: Branding */}
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Verifi Logo placeholder shape */}
              <div style={{ display: 'flex', width: '40px', height: '40px', backgroundColor: '#6366f1', borderRadius: '12px', justifyContent: 'center', alignItems: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <span style={{ fontSize: '32px', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>
                VERIFI
              </span>
            </div>
            
            <div style={{ display: 'flex', fontSize: '20px', fontWeight: 700, color: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '12px 24px', borderRadius: '100px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              Independent Revenue Audit
            </div>
          </div>

          {/* Middle Content */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
              <h1 style={{ fontSize: '96px', fontWeight: 900, color: 'white', textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>
                {startup.startup_name}
              </h1>
              {verificationState.trustScore > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', borderRadius: '100px', backgroundColor: `${trustColor}20`, border: `2px solid ${trustColor}40`, color: trustColor, fontSize: '24px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {trustLabel}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
              <span style={{ fontSize: '32px', fontWeight: 800, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                Verified MRR
              </span>
              <span style={{ fontSize: '80px', fontWeight: 900, color: 'white' }}>
                {formatInr(startup.mrr || 0)}
              </span>
            </div>
          </div>

          {/* Bottom Row: Metrics & Providers */}
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '48px' }}>
              
              {/* Authenticity Block */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                  Revenue Authenticity
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '48px', fontWeight: 900, color: 'white' }}>{verificationState.authenticityScore}</span>
                  <div style={{ display: 'flex', fontSize: '20px', fontWeight: 800, color: authColor, backgroundColor: `${authColor}20`, padding: '8px 16px', borderRadius: '100px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {verificationState.authenticityLevel}
                  </div>
                </div>
              </div>

              {/* Connected Providers Block */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                  Verified Connections
                </span>
                <div style={{ display: 'flex', gap: '16px', paddingTop: '8px' }}>
                  {verificationState.providersConnected.length > 0 ? (
                    verificationState.providersConnected.map(provider => (
                      <div key={provider} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px', backgroundColor: '#171717', borderRadius: '16px', border: '1px solid #262626' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '6px', backgroundColor: '#10b981' }} />
                        <span style={{ fontSize: '20px', fontWeight: 800, color: '#d4d4d4', textTransform: 'capitalize' }}>{provider}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ display: 'flex', fontSize: '20px', fontWeight: 800, color: '#ef4444' }}>
                      Unverified
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CTA */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Verify your startup on Verifi
              </span>
              <div style={{ display: 'flex', fontSize: '24px', fontWeight: 800, color: '#a3a3a3' }}>
                verifi.com
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: unknown) {
    console.log(`Failed to generate image`, e);
    return new Response(`Failed to generate image`, {
      status: 500,
    });
  }
}
