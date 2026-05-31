import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { supabaseServer } from "@/lib/supabase-server";
import { Navbar } from "@/components/layout/Navbar";
import { FolderKanban, CheckCircle2, Eye, Pencil, ShieldCheck, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";

function getStatusConfig(status: string | null): { label: string; color: string; bg: string } {
  switch (status) {
    case "api_verified":
    case "verified":
    case "REVENUE_VERIFIED":
    case "HIGH_CONFIDENCE":
      return { label: "Verified", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    case "stripe_connected":
    case "PAYMENT_CONNECTED":
      return { label: "Payment Connected", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" };
    case "proof_submitted":
      return { label: "Proof Submitted", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" };
    case "pending":
    case "SELF_REPORTED":
      return { label: "Self-Reported", color: "text-neutral-400", bg: "bg-neutral-500/10 border-neutral-500/20" };
    default:
      return { label: "Pending", color: "text-neutral-500", bg: "bg-neutral-500/10 border-neutral-500/20" };
  }
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/submit");
  }

  // Fetch startups owned by authenticated user
  const { data: startups } = await supabaseServer
    .from("startup_submissions")
    .select("id, startup_name, slug, verification_status, trust_tier, startup_logo, updated_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const startupCount = startups?.length || 0;

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

        {/* Metrics Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-12">
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

        {/* Startup Listing */}
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
            <div className="space-y-3">
              {startups!.map((startup) => {
                const status = getStatusConfig(startup.verification_status);
                const slug = startup.slug || startup.id;
                const lastUpdated = startup.updated_at || startup.created_at;

                return (
                  <div
                    key={startup.id}
                    className="group rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-lg"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      {/* Left: Logo + Info */}
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                          {startup.startup_logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={startup.startup_logo}
                              alt={startup.startup_name}
                              className="h-full w-full object-contain p-1"
                            />
                          ) : (
                            <span className="text-lg font-bold text-muted-foreground">
                              {startup.startup_name?.[0]?.toUpperCase() || "S"}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-syne text-base font-bold truncate">
                            {startup.startup_name}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${status.bg} ${status.color}`}>
                              {status.label === "Verified" && <ShieldCheck className="h-3 w-3" />}
                              {status.label}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatRelativeDate(lastUpdated)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0 sm:ml-4">
                        <Link
                          href={`/startup/${encodeURIComponent(slug)}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span className="hidden xs:inline">View</span>
                        </Link>
                        <Link
                          href={`/startup/${encodeURIComponent(slug)}/edit`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="hidden xs:inline">Edit</span>
                        </Link>
                        <Link
                          href={`/startup/${encodeURIComponent(slug)}/verify`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span className="hidden xs:inline">Verify</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
