import { verifyStartupOwnership } from "@/lib/auth-server";
import { FounderVerificationFlow } from "@/components/startup/FounderVerificationFlow";
import { Navbar } from "@/components/layout/Navbar";
import { VerifyLoginPrompt } from "@/components/auth/VerifyLoginPrompt";
import { AlertTriangle, Lock } from "lucide-react";
import Link from "next/link";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);

  const { authenticated, owned, startup, isDemo } = await verifyStartupOwnership(slug);

  if (!startup) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col items-center justify-center">
        <Navbar />
        <AlertTriangle className="w-12 h-12 text-neutral-600 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Profile Not Found</h1>
        <p className="text-neutral-400">The requested startup profile could not be located.</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col items-center justify-center">
        <Navbar />
        <Lock className="w-12 h-12 text-primary mb-4" />
        <h1 className="text-2xl font-bold mb-2">Authentication Required</h1>
        <p className="text-neutral-400 text-sm mb-6 max-w-md text-center">
          You must be logged in to execute verification actions for this company.
        </p>
        <VerifyLoginPrompt slug={slug} />
        <Link href="/" className="mt-6 text-xs font-bold uppercase tracking-wider text-neutral-500 hover:text-white">
          Back to home
        </Link>
      </div>
    );
  }

  const hasAccess = owned || isDemo;

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col items-center justify-center">
        <Navbar />
        <Lock className="w-12 h-12 text-rose-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-neutral-400 text-sm mb-6 max-w-md text-center">
          You do not have administrative ownership permissions to run audits for {startup.startup_name}.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col">
      <Navbar />

      {isDemo && (
        <div className="bg-[#0f0f11] border-b border-primary/20 px-6 py-4 flex items-center justify-center gap-3 mt-16">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            <strong>Sandbox Demonstration:</strong> Pre-verifying simulated example startup.
          </span>
        </div>
      )}

      <main className="flex-1 flex flex-col items-center justify-center p-6 mt-20">
        <div className="w-full max-w-2xl text-center mb-12">
          <p className="text-primary font-bold uppercase tracking-widest text-xs mb-3">Revenue Verification</p>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
            Audit {startup.startup_name}
          </h1>
        </div>

        <FounderVerificationFlow startupId={startup.id} slug={slug} isDemo={isDemo} />
      </main>
    </div>
  );
}
