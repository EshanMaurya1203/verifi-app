"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, Globe, User, ShieldCheck, XCircle, ArrowRight, CircleDashed, Award, Zap, TrendingUp, X, Upload, CreditCard, Loader2, Linkedin, Sparkles } from "lucide-react";

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
};

interface VerificationFlowProps {
  initialStartup: StartupProfile;
  id: number;
}

export default function VerificationFlow({ initialStartup, id }: VerificationFlowProps) {
  const [startup, setStartup] = useState<StartupProfile>(initialStartup);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pointsGained, setPointsGained] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<{ field: string; message: string } | null>(null);

  // --- Logic ---
  const isApproved = startup?.verification_status === "approved";
  const hasProof = !!startup?.proof_url;
  const hasWebsite = !!startup?.website && !startup.website.includes('@');
  const hasIdentity = !!startup?.founder_name;
  const hasLinkedIn = !!startup?.founder_linkedin;
  const hasPaymentSource = startup?.verification_method === "api" || startup?.verification_method === "razorpay";

  const steps = [hasProof, hasWebsite, hasIdentity, hasPaymentSource];
  const stepsCompleted = steps.filter(Boolean).length;
  const totalSteps = steps.length;
  const stepsRemaining = totalSteps - stepsCompleted;

  const points = { proof: 20, website: 10, identity: 20, linkedin: 10, twitter: 5, payment: 50 };
  const earnedPoints = (hasProof ? points.proof : 0) + (hasWebsite ? points.website : 0) + (hasIdentity ? points.identity : 0) + (hasLinkedIn ? points.linkedin : 0) + (startup?.founder_twitter ? points.twitter : 0) + (hasPaymentSource ? points.payment : 0);
  const progress = Math.min(100, Math.round((earnedPoints / 115) * 100));

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
      setStartup(updated);
      setSuccessMsg(msg);
      setPointsGained(pointsVal);
      setActiveModal(null);
      setTimeout(() => { setSuccessMsg(null); setPointsGained(null); }, 4000);
    }
    setLoading(false);
  };

  const handleStripeConnect = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setErrorMsg({ field: "payment", message: data.error || "Failed to initiate Stripe" });
      }
    } catch (err) {
      setErrorMsg({ field: "payment", message: "Network error during Stripe initiation" });
    }
    setLoading(false);
  };

  const handleRazorpayConnect = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/razorpay/create-account", { 
        method: "POST",
        body: JSON.stringify({ id, founder_name: startup?.founder_name })
      });
      const data = await res.json();
      if (data.success) {
        await updateStartup({ verification_method: 'razorpay' }, "Razorpay identity linked!", 50);
      } else {
        setErrorMsg({ field: "payment", message: data.error || "Razorpay integration failed" });
      }
    } catch (err) {
      setErrorMsg({ field: "payment", message: "Network error during Razorpay setup" });
    }
    setLoading(false);
  };

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
          <button onClick={() => setActiveModal('payment')} className={`w-full flex items-center justify-between p-4 rounded-2xl border ${hasPaymentSource ? 'bg-green-500/5 border-green-500/10 opacity-60' : 'bg-neutral-900 border-white/5 hover:border-white/10'}`}>
            <div className="flex items-center gap-3"><CreditCard className="w-4 h-4" /> <span className="text-sm font-medium">Link payment source (+50)</span></div>
            {!hasPaymentSource && <ArrowRight className="w-4 h-4" />}
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

            {activeModal === 'payment' && (
              <div className="space-y-8 text-center pb-4">
                <div className="space-y-2">
                  <CreditCard className="w-12 h-12 text-blue-400 mx-auto" />
                  <h3 className="text-2xl font-bold">Link Payment Gateway</h3>
                  <p className="text-sm text-neutral-400 max-w-xs mx-auto">Link your primary payment gateway to verify real-time revenue metrics (+50 trust score).</p>
                </div>

                {errorMsg?.field === 'payment' && (
                   <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-bold uppercase tracking-tighter">
                      {errorMsg.message}
                   </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <button onClick={handleStripeConnect} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-3 transition-all relative overflow-hidden">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Globe className="w-4 h-4" /> Link Stripe</>}
                  </button>
                  
                  <div className="relative flex items-center justify-center py-2">
                     <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
                     <span className="relative bg-neutral-900 px-3 text-[10px] font-black text-neutral-600 uppercase">Or</span>
                  </div>

                  <button onClick={handleRazorpayConnect} disabled={loading} className="w-full bg-neutral-950 border border-white/5 hover:border-white/10 text-white py-4 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-3 transition-all">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Link Razorpay"}
                  </button>
                </div>

                <p className="text-[10px] text-neutral-600 uppercase font-bold tracking-[0.2em] pt-4">Linking enables automated revenue audits</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
