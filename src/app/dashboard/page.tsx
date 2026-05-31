import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { supabaseServer } from "@/lib/supabase-server";
import { Navbar } from "@/components/layout/Navbar";
import { FolderKanban, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/submit");
  }

  // Fetch startups for the user
  const { data: startups } = await supabaseServer
    .from("startup_submissions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const startupCount = startups?.length || 0;
  
  // Define verified statuses according to the app's logic
  const verifiedStatuses = ["api_verified", "proof_submitted", "stripe_connected", "verified", "REVENUE_VERIFIED", "PAYMENT_CONNECTED", "HIGH_CONFIDENCE"];
  const verificationCount = startups?.filter(s => verifiedStatuses.includes(s.verification_status))?.length || 0;

  const userName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Founder";

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pt-24 pb-12">
        <div className="mb-10">
          <h1 className="font-syne text-[32px] sm:text-[40px] font-extrabold tracking-[-1px]">
            Welcome back, {userName}
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your verified startup identities and integrations.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-12">
          {/* Metrics Cards */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FolderKanban className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Startups</p>
                <p className="font-syne text-3xl font-bold">{startupCount}</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-500">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Verifications</p>
                <p className="font-syne text-3xl font-bold">{verificationCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-syne text-2xl font-bold">Your Startups</h2>
            {startupCount > 0 && (
              <Link
                href="/submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-all hover:bg-[#a8e630]"
              >
                Add Startup
              </Link>
            )}
          </div>

          {startupCount === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FolderKanban className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-syne text-xl font-bold mb-2">No startups yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                You haven&apos;t added any startups to Verifi. Get started by submitting your first company for verification.
              </p>
              <Link
                href="/submit"
                className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-[#a8e630]"
              >
                Add Your First Startup
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">
                Startup management interface will be available here soon.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
