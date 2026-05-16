import { FounderVerificationFlow } from "@/components/startup/FounderVerificationFlow";
import { Navbar } from "@/components/layout/Navbar";
import { supabaseServer } from "@/lib/supabase-server";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  const { data: startup } = await supabaseServer
    .from("startup_submissions")
    .select("id, startup_name")
    .eq("slug", resolvedParams.slug)
    .single();

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center p-6 mt-20">
        <div className="w-full max-w-2xl text-center mb-12">
          <p className="text-indigo-400 font-bold uppercase tracking-widest text-xs mb-3">Verification Pipeline</p>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
            Audit {startup?.startup_name || "Startup"}
          </h1>
        </div>

        <FounderVerificationFlow startupId={startup?.id || ""} slug={resolvedParams.slug} />
      </main>
    </div>
  );
}
