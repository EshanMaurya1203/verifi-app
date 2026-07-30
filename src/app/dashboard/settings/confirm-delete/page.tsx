import { getAuthenticatedUser } from "@/lib/auth-server";
import { supabaseServer } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { ConfirmDeleteAction } from "@/components/dashboard/settings/ConfirmDeleteAction";
import { isValidReauthAction } from "@/lib/reauth-proof";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confirm Security Action | Settings",
  description: "Re-authenticate to confirm account or startup deletion.",
};

export const dynamic = "force-dynamic";

export default async function ConfirmDeletePage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/submit");
  }

  const resolvedParams = await searchParams;
  const action = resolvedParams.action || "";

  if (!action || !isValidReauthAction(action)) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 pt-24 pb-12">
          <ConfirmDeleteAction
            action=""
            userEmail={user.email || ""}
          />
        </main>
      </div>
    );
  }

  let startupId: string | undefined;
  let startupName: string | undefined;

  if (action.startsWith("delete-startup:")) {
    startupId = action.slice("delete-startup:".length);
    const { data: startup } = await supabaseServer
      .from("startup_submissions")
      .select("startup_name")
      .eq("id", Number(startupId))
      .eq("user_id", user.id)
      .maybeSingle();

    startupName = startup?.startup_name || `Startup #${startupId}`;
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pt-24 pb-12">
        <h1 className="text-3xl font-black uppercase tracking-tighter mb-8">Security Re-authentication</h1>
        <ConfirmDeleteAction
          action={action}
          userEmail={user.email || ""}
          startupId={startupId}
          startupName={startupName}
        />
      </main>
    </div>
  );
}
