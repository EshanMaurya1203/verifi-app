import { getSupabaseServer } from "@/lib/supabase-server";
import { Navbar } from "@/components/layout/Navbar";
import { ShieldCheck, AlertTriangle, TrendingUp, Award, Globe, ExternalLink } from "lucide-react";
import VerificationFlow from "@/components/startup/VerificationFlow";

export default async function StartupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const id = parseInt(resolvedParams.id, 10);

  if (Number.isNaN(id)) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white font-sans">
        <Navbar />
        <main className="flex items-center justify-center pt-32">
          <p className="text-red-400 font-bold">Invalid startup ID</p>
        </main>
      </div>
    );
  }

  const supabase = getSupabaseServer();
  const { data: startup, error } = await supabase
    .from("startup_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !startup) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white font-sans">
        <Navbar />
        <main className="flex flex-col items-center justify-center pt-32 gap-4">
          <AlertTriangle className="w-12 h-12 text-neutral-700" />
          <p className="text-neutral-400 text-lg">
            {error ? `Database error: ${error.message}` : "Startup profile not found"}
          </p>
        </main>
      </div>
    );
  }

  const isApproved = startup.verification_status === "approved";
  
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 0,
    }).format(val);

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-indigo-500/30">
      <Navbar />

      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        {/* Profile Header (Static) */}
        <section className="flex flex-col gap-6 border-b border-white/5 pb-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              {startup.startup_name}
            </h1>
            <div className="flex items-center gap-1.5 border-l border-white/10 pl-4 text-indigo-400/80 font-bold text-xs uppercase tracking-widest self-start md:self-center">
              <TrendingUp className="w-4 h-4" />
              Ranked #{id}
            </div>
          </div>
          <p className="text-xs text-neutral-600 font-medium">
             Ranked based on verification depth. High-trust signals provide 3x investor visibility.
          </p>
        </section>

        {/* Client-Side Interactive Flow */}
        <VerificationFlow initialStartup={startup} id={id} />

        {/* Static Metrics Dashboard */}
        <section className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-neutral-900/40 border border-white/5 p-8 rounded-3xl relative overflow-hidden group">
            <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
              {isApproved ? "Verified Revenue (MRR)" : "Reported Revenue (MRR)"}
            </p>
            <p className="text-3xl font-bold tabular-nums tracking-tighter">{formatCurrency(startup.mrr)}</p>
          </div>
          <div className="bg-neutral-900/40 border border-white/5 p-8 rounded-3xl h-full flex flex-col justify-between">
            <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">Verification Context</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Method</span>
              <span className="font-bold text-neutral-300 capitalize">{startup.verification_method || "Manual Entry"}</span>
            </div>
            {!isApproved && (
               <div className="mt-4 flex items-center gap-2 text-xs text-amber-500/80 font-medium bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Not independently audited</span>
               </div>
            )}
          </div>
        </section>

        {/* Static Audit Notes */}
        {startup.trust_summary && startup.trust_summary.length > 0 && (
          <section className="mt-16 border-t border-white/5 pt-10 px-4">
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-xs font-bold text-neutral-600 uppercase tracking-[0.3em]">Protocol Review Notes</h2>
               <Award className="w-4 h-4 text-neutral-800" />
            </div>
            <div className="grid grid-cols-1 gap-4 text-center">
              {startup.trust_summary.map((point: string, i: number) => (
                <div key={i} className="p-6 bg-neutral-900/20 border border-white/5 rounded-2xl">
                  <p className="text-sm text-neutral-400 leading-relaxed italic">“ {point} ”</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
