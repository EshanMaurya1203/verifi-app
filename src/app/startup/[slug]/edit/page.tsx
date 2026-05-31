import { verifyStartupOwnership } from "@/lib/auth-server";
import { Navbar } from "@/components/layout/Navbar";
import { EditFounderForm } from "./EditFounderForm";
import { AlertTriangle, Lock } from "lucide-react";

export default async function EditStartupProfile({ params }: { params: Promise<{ slug: string }> }) {
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
          You must be logged in to modify the public identity of this company.
        </p>
      </div>
    );
  }

  if (isDemo) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col items-center justify-center">
        <Navbar />
        <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Sandbox Profile Locked</h1>
        <p className="text-neutral-400 text-sm mb-6 max-w-md text-center">
          Simulated demo startups are read-only to preserve playground integrity.
        </p>
      </div>
    );
  }

  if (!owned) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col items-center justify-center">
        <Navbar />
        <Lock className="w-12 h-12 text-rose-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-neutral-400 text-sm mb-6 max-w-md text-center">
          You do not have administrative ownership permissions for {startup.startup_name}.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans">
      <Navbar />
      <main className="max-w-2xl mx-auto px-6 pt-32 pb-24">
        <div className="mb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">Edit Identity</h1>
          <p className="text-neutral-400 text-sm">
            Update the public facing identity for {startup.startup_name}.
          </p>
        </div>
        
        <EditFounderForm startup={startup} slug={slug} />
      </main>
    </div>
  );
}
