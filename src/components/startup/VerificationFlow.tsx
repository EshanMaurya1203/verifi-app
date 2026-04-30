"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, Globe, User, ShieldCheck, XCircle, ArrowRight, CircleDashed, Award, Zap, TrendingUp, X, Upload, CreditCard, Loader2, Link as LinkIcon, Sparkles, Video } from "lucide-react";

type StartupProfile = {
  id: number;
  startup_name?: string;
  founder_name?: string;
  website?: string;
  proof_url?: string;
  verification_method?: string;
  verification_status?: string;
  founder_linkedin?: string;
  founder_twitter?: string;
  trust_breakdown?: any;
  video_url?: string;
  trust_score?: number;
  mrr?: number;
  email?: string;
};

interface VerificationFlowProps {
  initialStartup: StartupProfile;
  id: number | string;
}

export default function VerificationFlow({ initialStartup, id }: VerificationFlowProps) {
  const [startup, setStartup] = useState<StartupProfile>(initialStartup);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pointsGained, setPointsGained] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<{ field: string; message: string } | null>(null);
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [stripeKey, setStripeKey] = useState("");
  const [paymentView, setPaymentView] = useState<"options" | "razorpay" | "stripe">("options");
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stripeSuccess, setStripeSuccess] = useState(false);
  const [razorpayError, setRazorpayError] = useState<string | null>(null);

  const [connections, setConnections] = useState<{provider: string; amount: number}[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    async function fetchConnections() {
      const res = await fetch(`/api/startup/${id}/connections`);
      if (res.ok) {
        const data = await res.json();
        if (data.providers) setConnections(data.providers);
        if (data.totalMRR !== undefined) setTotalRevenue(data.totalMRR);
      }
    }
    fetchConnections();
  }, [id, successMsg]);

  // --- Logic ---
  const isApproved = startup?.verification_status === "approved";
  const hasProof = !!startup?.proof_url;
  const hasWebsite = !!startup?.website && !startup.website.includes('@');
  const hasIdentity = !!startup?.founder_name;
  const hasLinkedIn = !!startup?.founder_linkedin;
  const hasPaymentSource = startup?.verification_method === "api" || startup?.verification_method === "razorpay" || startup?.verification_method === "stripe" || connections.length > 0;
  const hasVideo = !!startup?.video_url;

  const hasStripe = connections.some(c => c.provider === "stripe");
  const hasRazorpay = connections.some(c => c.provider === "razorpay");

  const [isRefreshing, setIsRefreshing] = useState(false);

  const steps = [hasProof, hasWebsite, hasIdentity, connections.length > 0, hasVideo];
  const stepsCompleted = steps.filter(Boolean).length;
  const totalSteps = steps.length;

  const progress = startup?.trust_score !== undefined ? startup.trust_score : 0;

  const getStrengthLevel = (score: number) => {
    if (score <= 30) return { label: "Weak", color: "text-red-400", bg: "bg-red-400/10", msg: "Your profile lacks key verification signals" };
    if (score <= 70) return { label: "Moderate", color: "text-amber-400", bg: "bg-amber-400/10", msg: "You're halfway there — improve visibility" };
    return { label: "Strong", color: "text-green-400", bg: "bg-green-400/10", msg: "High trust profile — ranks higher" };
  };
  const strength = getStrengthLevel(progress);

  // --- Actions ---
  const updateStartup = async (data: any, msg: string, pointsVal: number) => {
    setLoading(true);
    const { data: updated, error } = await supabase.from("startup_submissions").update(data).eq("id", id).select().single();
    if (!error) {
      // Trigger deterministic re-score
      const res = await fetch("/api/trust/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startup_id: id })
      });
      const scoreData = await res.json();
      
      setStartup({ ...updated, ...scoreData });
      setSuccessMsg(msg);
      setPointsGained(pointsVal);
      setActiveModal(null);
      setTimeout(() => { setSuccessMsg(null); setPointsGained(null); }, 4000);
    }
    setLoading(false);
  };

  const [selectedCountry, setSelectedCountry] = useState("US");

  const handleStripeVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripeKey.startsWith("sk_")) {
      setStripeError("Invalid format. Key must start with sk_");
      return;
    }
    setLoading(true);
    setStripeError(null);
    try {
      const res = await fetch("/api/stripe/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: stripeKey,
          startupId: id
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.revenue !== undefined) {
        setStripeSuccess(true);
        await updateStartup({
          payment_connected: true,
          last_verified_at: new Date().toISOString()
        }, "Stripe connected: Revenue synced!", 50);
        
        // Modal will stay open for a moment to show success state before auto-closing
        setTimeout(() => {
          setActiveModal(null);
          setPaymentView("options");
          setStripeSuccess(false);
          setStripeKey("");
        }, 2500);
      } else {
        setStripeError(data.error || "Stripe verification failed");
      }
    } catch (err: any) {
      setStripeError(err.message);
    }
    setLoading(false);
  };

  const handleRazorpayVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setRazorpayError(null);

    try {
      const res = await fetch("/api/razorpay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key_id: keyId,
          key_secret: keySecret,
          startup_id: id
        })
      });
      const data = await res.json();

      if (data.success) {
        await updateStartup({
          payment_connected: true,
          last_verified_at: new Date().toISOString()
        }, "Razorpay connected & revenue audited!", 50);
        setPaymentView("options");
      } else {
        setRazorpayError(data.error || "Connection failed");
      }
    } catch (err) {
      setRazorpayError("Network error during verification");
    }
    setLoading(false);
  };

  const handleRefreshRevenue = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/verify/revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startup_id: id
        })
      });
      const data = await res.json();
      if (data.success) {
        await updateStartup({
          last_verified_at: new Date().toISOString()
        }, `Revenue refreshed: ₹${Math.round(data.revenue).toLocaleString()}`, 10);
      }
    } catch (err) {
      console.error("Refresh error:", err);
    }
    setIsRefreshing(false);
  };

  const isRazorpayValid = keyId.startsWith("rzp_") && keySecret.length > 10;
  const isStripeValid = stripeKey.startsWith("sk_") && stripeKey.length > 20;

  return (
    <div className="relative">
      {pointsGained && (
        <div className="fixed top-32 left-1/2 -translate-x-1/2 z-[110] bg-white text-black px-6 py-4 rounded-3xl font-black shadow-2xl flex items-center gap-3 animate-bounce">
          <div className="bg-green-500 p-1 rounded-full"><ShieldCheck className="w-5 h-5 text-white" /></div>
          <span className="uppercase tracking-tighter">+{pointsGained} Trust Gained</span>
          <Sparkles className="w-5 h-5 text-amber-500" />
        </div>
      )}

      {successMsg && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 border border-white/10 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-green-400" /> {successMsg}
      </div>}

      {/* Strength Section */}
      <section className="mt-12 bg-neutral-900/40 border border-white/5 rounded-3xl overflow-hidden p-8 flex flex-col md:flex-row gap-10 items-center">
        <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
          <svg className="w-full h-full -rotate-90">
            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={364.4} strokeDashoffset={364.4 - (364.4 * progress) / 100} className={`transition-all duration-1000 ${strength.color}`} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black">{progress}%</span>
            <span className="text-[10px] uppercase font-bold text-neutral-500">Strength</span>
          </div>
        </div>
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <h2 className="text-xl font-bold">Profile Strength</h2>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-tighter ${strength.color} ${strength.bg}`}>{strength.label}</span>
          </div>
          <p className="text-sm text-neutral-400 font-medium">{strength.msg}</p>
          <div className="flex flex-wrap gap-4 justify-center md:justify-start">
            <div className="px-4 py-2 bg-white/5 border border-white/5 rounded-2xl text-[10px] uppercase font-bold text-neutral-500 text-center">
              Verification <p className="text-sm font-bold text-indigo-400">{stepsCompleted}/{totalSteps} Steps</p>
            </div>
            {hasPaymentSource && (
              <button
                onClick={handleRefreshRevenue}
                disabled={isRefreshing}
                className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[10px] uppercase font-bold text-indigo-400 hover:bg-indigo-500/20 transition-all flex items-center gap-2"
              >
                {isRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Refresh Revenue
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Revenue Sources */}
      <section className="mt-6 bg-neutral-900/20 border border-white/5 p-8 rounded-3xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="space-y-1">
            <h3 className="text-xl font-bold">Connect your revenue sources</h3>
            <p className="text-sm text-neutral-500 font-medium tracking-tight">Link multiple providers. Trust score increments dynamically per provider.</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest block">Aggregated Total MRR</span>
            <span className="text-2xl font-black text-green-400">
              ₹{totalRevenue.toLocaleString()}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`p-5 rounded-3xl border transition-all ${hasStripe ? 'bg-indigo-500/5 border-indigo-500/20 shadow-[0_0_30px_rgba(99,91,255,0.05)]' : 'bg-neutral-900 border-white/5 hover:border-white/10'}`}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${hasStripe ? 'bg-indigo-500/10' : 'bg-white/5'}`}>
                  <Globe className={`w-6 h-6 ${hasStripe ? 'text-indigo-400' : 'text-neutral-500'}`} />
                </div>
                <div>
                  <h4 className="font-bold text-lg">Stripe Global</h4>
                  <p className="text-[10px] text-neutral-500 uppercase font-black tracking-wider">USD / Global</p>
                </div>
              </div>
              {hasStripe ? (
                <span className="px-3 py-1 bg-green-500/10 text-green-400 text-[10px] uppercase font-bold tracking-widest border border-green-500/20 rounded-lg flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Connected</span>
              ) : (
                <button onClick={() => { setPaymentView('stripe'); setActiveModal('payment'); }} className="px-4 py-2 bg-white text-black text-[10px] uppercase font-black tracking-widest rounded-xl hover:bg-neutral-200 transition-colors shadow-lg shadow-white/10">Connect</button>
              )}
            </div>
            {hasStripe && (
              <div className="pt-4 border-t border-white/5 flex justify-between items-end">
                <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest">Provider MRR</span>
                <span className="text-xl font-bold">₹{connections.find(c => c.provider === 'stripe')?.amount?.toLocaleString() || 0}</span>
              </div>
            )}
          </div>

          <div className={`p-5 rounded-3xl border transition-all ${hasRazorpay ? 'bg-blue-500/5 border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.05)]' : 'bg-neutral-900 border-white/5 hover:border-white/10'}`}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${hasRazorpay ? 'bg-blue-500/10' : 'bg-white/5'}`}>
                  <CreditCard className={`w-6 h-6 ${hasRazorpay ? 'text-blue-400' : 'text-neutral-500'}`} />
                </div>
                <div>
                  <h4 className="font-bold text-lg">Razorpay</h4>
                  <p className="text-[10px] text-neutral-500 uppercase font-black tracking-wider">INR / India</p>
                </div>
              </div>
              {hasRazorpay ? (
                <span className="px-3 py-1 bg-green-500/10 text-green-400 text-[10px] uppercase font-bold tracking-widest border border-green-500/20 rounded-lg flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Connected</span>
              ) : (
                <button onClick={() => { setPaymentView('razorpay'); setActiveModal('payment'); }} className="px-4 py-2 bg-white text-black text-[10px] uppercase font-black tracking-widest rounded-xl hover:bg-neutral-200 transition-colors shadow-lg shadow-white/10">Connect</button>
              )}
            </div>
            {hasRazorpay && (
              <div className="pt-4 border-t border-white/5 flex justify-between items-end">
                <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest">Provider MRR</span>
                <span className="text-xl font-bold">₹{connections.find(c => c.provider === 'razorpay')?.amount?.toLocaleString() || 0}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Improvement Actions */}
      <section className="mt-6 bg-neutral-900/20 border border-white/5 p-8 rounded-3xl space-y-6">
        <h3 className="text-xs uppercase font-black text-neutral-500 tracking-[0.2em]">Improve your profile:</h3>
        <div className="space-y-3">
          <button onClick={() => setActiveModal('website')} className={`w-full flex items-center justify-between p-4 rounded-2xl border ${hasWebsite ? 'bg-green-500/5 border-green-500/10 opacity-60' : 'bg-neutral-900 border-white/5 hover:border-white/10'}`}>
            <div className="flex items-center gap-3"><Globe className="w-4 h-4" /> <span className="text-sm font-medium">Add website (+10)</span></div>
            {!hasWebsite && <ArrowRight className="w-4 h-4" />}
          </button>
          <button onClick={() => setActiveModal('kyc')} className={`w-full flex items-center justify-between p-4 rounded-2xl border ${hasIdentity ? 'bg-green-500/5 border-green-500/10 opacity-60' : 'bg-neutral-900 border-white/5 hover:border-white/10'}`}>
            <div className="flex items-center gap-3"><User className="w-4 h-4" /> <span className="text-sm font-medium">Complete KYC (+20)</span></div>
            {!hasIdentity && <ArrowRight className="w-4 h-4" />}
          </button>
          <button onClick={() => setActiveModal('video')} className={`w-full flex items-center justify-between p-4 rounded-2xl border ${hasVideo ? 'bg-green-500/5 border-green-500/10 opacity-60' : 'bg-neutral-900 border-white/5 hover:border-white/10'}`}>
            <div className="flex items-center gap-3"><Video className="w-4 h-4" /> <span className="text-sm font-medium">Founder video (+30)</span></div>
            {!hasVideo && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </section>

      {/* Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
          <div className="relative bg-neutral-900 border border-white/10 w-full max-w-lg rounded-3xl p-8 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <button onClick={() => setActiveModal(null)} className="absolute top-6 right-6 p-2 rounded-xl hover:bg-white/5"><X className="w-5 h-5 text-neutral-500" /></button>

            {activeModal === 'website' && (
              <form onSubmit={async (e) => { e.preventDefault(); await updateStartup({ website: (e.target as any).website.value }, "Website linked!", 10); }} className="space-y-6">
                <h3 className="text-xl font-bold">Business Website</h3>
                <input name="website" placeholder="startup.com" defaultValue={startup?.website} required autoFocus className="w-full bg-neutral-950 border border-white/5 p-4 rounded-xl outline-none focus:border-indigo-500" />
                <button disabled={loading} className="w-full bg-white text-black py-4 rounded-xl font-bold uppercase tracking-[0.1em]">{loading ? "Saving..." : "Save Website (+10)"}</button>
              </form>
            )}

            {activeModal === 'kyc' && (
              <form onSubmit={async (e) => { e.preventDefault(); const form = e.target as any; await updateStartup({ founder_name: form.founder.value, founder_linkedin: form.linkedin.value, founder_twitter: form.twitter.value }, "Identity updated!", 20); }} className="space-y-4">
                <h3 className="text-xl font-bold">Founder Identity</h3>
                <input name="founder" placeholder="Full Name" defaultValue={startup?.founder_name} required className="w-full bg-neutral-950 border border-white/5 p-3 rounded-xl outline-none" />
                <input name="linkedin" placeholder="LinkedIn URL" defaultValue={startup?.founder_linkedin} className="w-full bg-neutral-950 border border-white/5 p-3 rounded-xl outline-none" />
                <button disabled={loading} className="w-full bg-white text-black py-4 rounded-xl font-bold uppercase tracking-[0.1em]">{loading ? "Saving..." : "Save Identity (+20)"}</button>
              </form>
            )}

            {activeModal === 'video' && (
              <form onSubmit={async (e) => { e.preventDefault(); await updateStartup({ video_url: (e.target as any).video.value }, "Founder video linked!", 30); }} className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
                    <Video className="w-6 h-6 text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold">Founder Video Verification</h3>
                  <p className="text-sm text-neutral-500">Provide a Loom or YouTube link of the founder explaining the business for maximum trust (+30).</p>
                </div>
                <input name="video" placeholder="loom.com/share/..." required autoFocus className="w-full bg-neutral-950 border border-white/5 p-4 rounded-xl outline-none focus:border-indigo-500" />
                <button disabled={loading} className="w-full bg-white text-black py-4 rounded-xl font-bold uppercase tracking-[0.1em]">{loading ? "Saving..." : "Link founder video (+30)"}</button>
              </form>
            )}

            {activeModal === 'payment' && (
              <div className="space-y-8 text-center pb-4">
                {paymentView === "stripe" && (
                  <form onSubmit={handleStripeVerify} className="space-y-6 text-left">
                    <button type="button" onClick={() => setActiveModal(null)} className="text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-1 hover:text-white transition-colors">
                      ← Close
                    </button>
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold">Stripe Verification</h3>
                      <p className="text-xs text-neutral-500 font-medium">Link your account via secret API key.</p>
                    </div>

                    {stripeError && (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
                        <div className="text-xs text-red-400 font-bold uppercase tracking-tighter">
                          {stripeError}
                        </div>
                        <p className="text-[10px] text-red-400/60 font-medium">Please double check your credentials and try again.</p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Stripe Secret Key</label>
                        <input
                          type="password"
                          required
                          placeholder="sk_live_..."
                          value={stripeKey}
                          onChange={(e) => setStripeKey(e.target.value)}
                          disabled={loading || stripeSuccess}
                          className={`w-full bg-neutral-950 border p-4 rounded-xl outline-none transition-colors text-sm font-mono ${stripeSuccess ? 'border-green-500/20 text-green-500/50' : 'border-white/5 focus:border-indigo-500'}`}
                          autoFocus
                        />
                      </div>

                      {stripeSuccess ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                          <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                            <div className="space-y-0.5">
                              <p className="text-sm font-black text-green-400 uppercase tracking-tighter">Stripe connected successfully</p>
                              <p className="text-[10px] text-green-500/60 font-bold uppercase tracking-widest">Revenue synced</p>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                              <CircleDashed className="w-3 h-3 animate-spin" />
                              Last synced: Just now
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[10px] text-neutral-600 font-medium leading-relaxed">
                            Find this in <span className="text-neutral-400 italic">Stripe Dashboard → Developers → API keys</span>
                          </p>
                          <p className="text-[10px] text-amber-500/80 font-bold uppercase tracking-tight flex items-center gap-1.5">
                            <ShieldCheck className="w-3 h-3" />
                            Keys are encrypted and used only for read-only audits.
                          </p>
                        </div>
                      )}
                    </div>

                    {!stripeSuccess && (
                      <button
                        type="submit"
                        disabled={loading || !isStripeValid}
                        className="w-full bg-white disabled:bg-neutral-800 disabled:text-neutral-500 text-black py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Sync Revenue"}
                      </button>
                    )}
                  </form>
                )}
                {paymentView === "razorpay" && (
                  <form onSubmit={handleRazorpayVerify} className="space-y-6 text-left">
                    <button type="button" onClick={() => setActiveModal(null)} className="text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-1 hover:text-white transition-colors">
                      ← Close
                    </button>
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold">Razorpay Credentials</h3>
                      <p className="text-xs text-neutral-500 font-medium">Link your account to verify real-time revenue.</p>
                    </div>

                    {razorpayError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-bold uppercase tracking-tighter">
                        {razorpayError}
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Key ID</label>
                        <input
                          type="text"
                          required
                          placeholder="rzp_test_..."
                          value={keyId}
                          onChange={(e) => setKeyId(e.target.value)}
                          className="w-full bg-neutral-950 border border-white/5 p-4 rounded-xl outline-none focus:border-indigo-500 transition-colors text-sm font-mono"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Key Secret</label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••••••••••"
                          value={keySecret}
                          onChange={(e) => setKeySecret(e.target.value)}
                          className="w-full bg-neutral-950 border border-white/5 p-4 rounded-xl outline-none focus:border-indigo-500 transition-colors text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] text-neutral-600 font-medium leading-relaxed">
                          Find your keys in <span className="text-neutral-400 italic">Razorpay Dashboard → Settings → API Keys</span>
                        </p>
                        <p className="text-[10px] text-amber-500/80 font-bold uppercase tracking-tight flex items-center gap-1.5">
                          <ShieldCheck className="w-3 h-3" />
                          Keys are encrypted and used only for read-only audits.
                        </p>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !isRazorpayValid}
                      className="w-full bg-white disabled:bg-neutral-800 disabled:text-neutral-500 text-black py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify Connection"}
                    </button>
                  </form>
                )}
                <p className="text-[10px] text-neutral-600 uppercase font-bold tracking-[0.2em] pt-4">Linking enables automated revenue audits</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
