import Link from "next/link";
import { Pencil, Eye, CreditCard, ChevronRight } from "lucide-react";
import type { StartupStatus } from "@/lib/dashboard/startup-status";

interface QuickActionsProps {
  startupSlug: string;
  status: StartupStatus;
}

export function QuickActions({ startupSlug, status }: QuickActionsProps) {
  const actions = [];

  // 1. Preview Profile (only if verified but private)
  if (status.verification === "verified" && status.publication === "private") {
    actions.push({
      title: "Preview Profile",
      description: "See how it will look.",
      icon: <Eye className="h-5 w-5 text-emerald-500" />,
      bg: "bg-emerald-500/10",
      href: `/startup/${encodeURIComponent(startupSlug)}`,
    });
  }

  // 3. Edit Startup (always available, but lower priority if pending verification)
  actions.push({
    title: "Edit Startup",
    description: "Update your startup details.",
    icon: <Pencil className="h-5 w-5 text-blue-500" />,
    bg: "bg-blue-500/10",
    href: `/startup/${encodeURIComponent(startupSlug)}/edit`,
  });

  // 4. Manage Subscription
  actions.push({
    title: "Manage Subscription",
    description: "View billing & plans.",
    icon: <CreditCard className="h-5 w-5 text-purple-500" />,
    bg: "bg-purple-500/10",
    href: `/dashboard/billing`,
  });

  return (
    <div className="mb-8">
      <h2 className="font-syne text-lg font-bold mb-4">Quick Actions</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((action, i) => (
          <Link
            key={i}
            href={action.href}
            className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${action.bg}`}>
                {action.icon}
              </div>
              <div>
                <h3 className="font-syne text-base font-bold group-hover:text-primary transition-colors">
                  {action.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {action.description}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </div>
  );
}
