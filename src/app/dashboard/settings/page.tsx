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

export default async function SettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/submit");
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
            <DangerZone userEmail={user.email || ""} startups={startups || []} />
          </section>
        </div>
      </main>
    </div>
  );
}
