import { getAuthenticatedUser } from "@/lib/auth-server";
import { supabaseServer } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { AccountSettingsForm } from "@/components/dashboard/settings/AccountSettingsForm";
import { DangerZone } from "@/components/dashboard/settings/DangerZone";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | Dashboard",
  description: "Manage your account and startup settings.",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?next=/dashboard/settings");
  }

  const { data: startups } = await supabaseServer
    .from("startup_submissions")
    .select("id, startup_name")
    .eq("user_id", user.id);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pt-24 pb-12">
        <h1 className="text-3xl font-black uppercase tracking-tighter mb-8">Settings</h1>
        
        <div className="space-y-12">
          <section>
            <h2 className="text-xl font-semibold tracking-tight mb-6">Account Settings</h2>
            <AccountSettingsForm userEmail={user.email || ""} />
          </section>

          <section>
            <div className="bg-neutral-900/50 border border-white/5 p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Help Shape Verifii</h3>
                <p className="text-sm text-neutral-400">
                  Have an idea, spotted a bug, or want to share feedback? We personally review and reply to every submission.
                </p>
              </div>
              <a
                href="/feedback"
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider transition-colors text-center shrink-0 border border-white/10 hover:border-white/20"
              >
                Give Feedback
              </a>
            </div>
          </section>

          <section>
            <DangerZone userEmail={user.email || ""} startups={startups || []} />
          </section>
        </div>
      </main>
    </div>
  );
}
