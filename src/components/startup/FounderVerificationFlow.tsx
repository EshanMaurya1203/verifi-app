"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldCheck, 
  CreditCard, 
  Globe, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight,
  Fingerprint,
  ScanSearch,
  Activity
} from "lucide-react";

type VerificationStep = "connect" | "syncing" | "analyzing" | "summary" | "incomplete";

interface FounderVerificationFlowProps {
  startupId: string;
  slug: string;
}

export const FounderVerificationFlow: React.FC<FounderVerificationFlowProps> = ({ startupId, slug }) => {
  const router = useRouter();
  
  const [currentStep, setCurrentStep] = useState<VerificationStep>("connect");
  const [provider, setProvider] = useState<"stripe" | "razorpay" | null>(null);
  
  // Form State
  const [stripeKey, setStripeKey] = useState("");
  const [rzpKeyId, setRzpKeyId] = useState("");
  const [rzpKeySecret, setRzpKeySecret] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result State
  const [overviewData, setOverviewData] = useState<any>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(45);
  const [autoForwardSeconds, setAutoForwardSeconds] = useState(5);

  const STEPS = [
    { id: "connect", label: "Connect Provider" },
    { id: "syncing", label: "Sync Revenue" },
    { id: "analyzing", label: "Analyze Authenticity" },
    { id: "summary", label: "Trust Profile" }
  ];

  const getStepIndex = (step: VerificationStep) => {
    if (step === "incomplete") return 1;
    return STEPS.findIndex(s => s.id === step);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if ((currentStep === "syncing" || currentStep === "analyzing") && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000);
    }
    return () => clearInterval(timer);
  }, [currentStep, timeLeft]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (currentStep === "summary" && autoForwardSeconds > 0) {
      timer = setInterval(() => setAutoForwardSeconds(prev => prev - 1), 1000);
    } else if (currentStep === "summary" && autoForwardSeconds === 0) {
      handlePublish();
    }
    return () => clearInterval(timer);
  }, [currentStep, autoForwardSeconds]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStartTime(Date.now());
    setCurrentStep("syncing");
    setTimeLeft(45);

    try {
      let res;
      if (provider === "stripe") {
        res = await fetch("/api/sync/stripe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: stripeKey, startupId })
        });
      } else if (provider === "razorpay") {
        res = await fetch("/api/sync/razorpay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key_id: rzpKeyId, key_secret: rzpKeySecret, startup_id: startupId })
        });
      } else {
        throw new Error("No provider selected");
      }

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Verification failed");
      }

      // Sync successful, move to analysis
      setCurrentStep("analyzing");

      // Fetch overview data for authenticity and trust score
      const overviewRes = await fetch(`/api/startup/${startupId}/overview`);
      const overview = await overviewRes.json();
      
      if (!overviewRes.ok) throw new Error("Failed to generate trust profile");

      setOverviewData(overview);
      
      const timeTaken = startTime ? (Date.now() - startTime) / 1000 : 0;
      console.log(`[Verification] Time to first verification: ${timeTaken.toFixed(2)}s`);
      
      // Auto-progress to summary
      setCurrentStep("summary");

    } catch (err: any) {
      console.error(err);
      let friendlyError = err.message || "An unexpected error occurred";
      if (friendlyError.includes("failed to fetch")) friendlyError = "Network error: Please check your connection and try again.";
      if (friendlyError.includes("401")) friendlyError = "Invalid API Key: Please verify your credentials and try again.";
      
      setErrorMsg(friendlyError);
      setCurrentStep("incomplete");
    }
  };

  const handlePublish = () => {
    router.push(`/startup/${slug}`);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* ── Progress Bar ────────────────────────────────────────── */}
      <div className="mb-12 relative">
        <div className="flex items-center justify-between relative z-10">
          {STEPS.map((step, idx) => {
            const isActive = getStepIndex(currentStep) === idx;
            const isCompleted = getStepIndex(currentStep) > idx || currentStep === "summary";
            const isFailed = currentStep === "incomplete" && idx === 1;

            return (
              <div key={step.id} className="flex flex-col items-center gap-3 w-1/4">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500
                  ${isCompleted ? "bg-indigo-500 border-indigo-500 text-white" : 
                    isActive ? "bg-neutral-900 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,91,255,0.4)]" : 
                    isFailed ? "bg-red-500/10 border-red-500 text-red-500" :
                    "bg-neutral-900 border-white/10 text-neutral-600"}
                `}>
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : 
                   isFailed ? <AlertTriangle className="w-4 h-4" /> :
                   <span className="text-xs font-black">{idx + 1}</span>}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest text-center
                  ${isActive || isCompleted ? "text-neutral-300" : isFailed ? "text-red-400" : "text-neutral-600"}
                `}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
        {/* Track Line */}
        <div className="absolute top-4 left-0 right-0 h-[2px] bg-white/5 -z-0 rounded-full" />
        <div 
          className="absolute top-4 left-0 h-[2px] bg-indigo-500 -z-0 transition-all duration-700 ease-in-out"
          style={{ width: `${(getStepIndex(currentStep === "incomplete" ? "syncing" : currentStep) / (STEPS.length - 1)) * 100}%` }}
        />
      </div>

      {/* ── Content Area ────────────────────────────────────────── */}
      <div className="bg-neutral-900/40 border border-white/5 rounded-[2rem] p-8 min-h-[400px] flex flex-col relative overflow-hidden">
        
        {/* 1. Connect Provider */}
        {(currentStep === "connect" || currentStep === "incomplete") && (
          <div className="flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Connect Provider</h2>
              <p className="text-sm text-neutral-500 font-medium">Link your payment gateway for read-only automated verification.</p>
            </div>

            {errorMsg && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-xs text-red-400 font-bold uppercase tracking-wide leading-relaxed">{errorMsg}</p>
              </div>
            )}

            {!provider ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => setProvider("stripe")}
                  className="p-6 bg-neutral-900/80 border border-white/5 hover:border-indigo-500/50 hover:bg-indigo-500/5 rounded-2xl flex flex-col items-center gap-4 transition-all group"
                >
                  <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-indigo-500/10 transition-colors">
                    <Globe className="w-8 h-8 text-neutral-400 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <span className="font-bold text-lg">Stripe</span>
                </button>

                <button 
                  onClick={() => setProvider("razorpay")}
                  className="p-6 bg-neutral-900/80 border border-white/5 hover:border-blue-500/50 hover:bg-blue-500/5 rounded-2xl flex flex-col items-center gap-4 transition-all group"
                >
                  <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-blue-500/10 transition-colors">
                    <CreditCard className="w-8 h-8 text-neutral-400 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <span className="font-bold text-lg">Razorpay</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleConnect} className="space-y-6">
                <button 
                  type="button" 
                  onClick={() => setProvider(null)}
                  className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
                >
                  ← Back to Providers
                </button>

                {provider === "stripe" && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Stripe Secret Key</label>
                    <input 
                      required 
                      type="password" 
                      placeholder="sk_live_..." 
                      value={stripeKey}
                      onChange={(e) => setStripeKey(e.target.value)}
                      className="w-full bg-black border border-white/10 p-4 rounded-xl outline-none focus:border-indigo-500 font-mono text-sm"
                    />
                  </div>
                )}

                {provider === "razorpay" && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Razorpay Key ID</label>
                      <input 
                        required 
                        type="text" 
                        placeholder="rzp_live_..." 
                        value={rzpKeyId}
                        onChange={(e) => setRzpKeyId(e.target.value)}
                        className="w-full bg-black border border-white/10 p-4 rounded-xl outline-none focus:border-blue-500 font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Razorpay Key Secret</label>
                      <input 
                        required 
                        type="password" 
                        placeholder="••••••••••••••••" 
                        value={rzpKeySecret}
                        onChange={(e) => setRzpKeySecret(e.target.value)}
                        className="w-full bg-black border border-white/10 p-4 rounded-xl outline-none focus:border-blue-500 font-mono text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="p-4 bg-white/5 rounded-xl flex items-start gap-3 border border-white/5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-neutral-400 font-medium leading-relaxed">
                    Keys are encrypted at rest (AES-256-GCM) and used exclusively for read-only revenue aggregation.
                  </p>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-white text-black py-4 rounded-xl font-black uppercase tracking-[0.15em] text-[11px] hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
                >
                  Start Verification Pipeline <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* 2. & 3. Syncing / Analyzing */}
        {(currentStep === "syncing" || currentStep === "analyzing") && (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
              <div className="w-20 h-20 bg-neutral-900 border border-white/10 rounded-full flex items-center justify-center relative z-10">
                {currentStep === "syncing" ? (
                  <Activity className="w-8 h-8 text-indigo-400 animate-pulse" />
                ) : (
                  <ScanSearch className="w-8 h-8 text-violet-400 animate-spin-slow" />
                )}
              </div>
              <div className="absolute top-0 left-0 w-full h-full border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
            
            <h3 className="text-xl font-black uppercase tracking-widest mb-3">
              {currentStep === "syncing" ? "Syncing Revenue History" : "Running Authenticity Engine"}
            </h3>
            <p className="text-sm text-neutral-500 font-medium max-w-xs mx-auto mb-6">
              {currentStep === "syncing" 
                ? "Connecting to gateway and downloading transaction ledgers for the last 30 days..." 
                : "Analyzing event spacing, volume diversity, and checking for synthetic patterns..."}
            </p>

            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/5">
              <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Estimated time remaining: {timeLeft}s
              </span>
            </div>
          </div>
        )}

        {/* 4. Summary Screen */}
        {currentStep === "summary" && overviewData && (
          <div className="flex-1 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full mb-4 ring-1 ring-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-white mb-2">Audit Complete</h2>
              <p className="text-neutral-500 font-medium">Your trust profile has been successfully generated.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* Trust Score */}
              <div className="bg-black/50 border border-white/5 p-5 rounded-2xl flex flex-col items-center text-center">
                <ShieldCheck className="w-5 h-5 text-indigo-400 mb-3" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-1">Trust Score</span>
                <span className="text-3xl font-black tabular-nums text-white">{overviewData.startup.trust_score}<span className="text-sm text-neutral-600">/100</span></span>
              </div>

              {/* Authenticity */}
              <div className="bg-black/50 border border-white/5 p-5 rounded-2xl flex flex-col items-center text-center">
                <Fingerprint className={`w-5 h-5 mb-3 ${
                  overviewData.authenticity?.level === "Organic" ? "text-emerald-400" :
                  overviewData.authenticity?.level === "Moderate" ? "text-amber-400" : "text-orange-400"
                }`} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-1">Authenticity</span>
                <span className="text-xl font-black uppercase tracking-tight text-white">{overviewData.authenticity?.level || "N/A"}</span>
              </div>

              {/* Confidence */}
              <div className="bg-black/50 border border-white/5 p-5 rounded-2xl flex flex-col items-center text-center">
                <ScanSearch className="w-5 h-5 text-cyan-400 mb-3" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-1">Confidence</span>
                <span className="text-3xl font-black tabular-nums text-white">{overviewData.verification?.verification_confidence || 0}<span className="text-sm text-neutral-600">%</span></span>
              </div>
            </div>

            <button 
              onClick={handlePublish}
              className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[12px] hover:bg-neutral-200 hover:scale-[1.02] transition-all shadow-xl shadow-white/10 flex flex-col items-center justify-center gap-1 group"
            >
              <div className="flex items-center gap-2">
                Publish Verified Startup <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
              <span className="text-[9px] text-neutral-500 font-bold">Auto-redirecting in {autoForwardSeconds}s...</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
