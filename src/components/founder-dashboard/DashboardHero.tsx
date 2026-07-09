import Link from "next/link";
import { ShieldCheck, ArrowRight, Activity, Eye, Pencil, Globe, Lock } from "lucide-react";
import type { StartupStatus } from "@/lib/dashboard/startup-status";

interface DashboardHeroProps {
  displayName?: string | null;
  userName: string;
  startupName: string;
  status: StartupStatus;
  startupSlug: string;
}

export function DashboardHero({ displayName, userName, startupName, status, startupSlug }: DashboardHeroProps) {
  let message = "";
  let ctaText = "";
  let ctaLink = "";
  let CtaIcon = ArrowRight;
  let ctaStyle = "bg-primary text-primary-foreground hover:bg-[#a8e630]";
  let BadgeIcon = Lock;
  let badgeText = "Private";
  let badgeStyle = "bg-neutral-500/10 text-neutral-500 border-neutral-500/20";

  if (status.publication === "public") {
    message = "Live on Verifii — keep your revenue sync active to maintain trust.";
    ctaText = "View Public Profile";
    ctaLink = `/startup/${encodeURIComponent(startupSlug)}`;
    CtaIcon = Eye;
    ctaStyle = "bg-primary text-primary-foreground hover:bg-[#a8e630]";
    BadgeIcon = Globe;
    badgeText = "Public";
    badgeStyle = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  } else if (status.verification === "verified") {
    message = "Verified but private. Publish to get discovered.";
    ctaText = "Publish Startup";
    ctaLink = `/startup/${encodeURIComponent(startupSlug)}/edit`;
    CtaIcon = Pencil;
  } else if (status.verification === "pending") {
    message = "Verification in progress — analyzing your connected data.";
    ctaText = "Continue Verification";
    ctaLink = `/startup/${encodeURIComponent(startupSlug)}/verify`;
    CtaIcon = Activity;
  } else {
    message = "Complete verification to publish your profile and build trust.";
    ctaText = "Resume Verification";
    ctaLink = `/startup/${encodeURIComponent(startupSlug)}/verify`;
    CtaIcon = ShieldCheck;
  }

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
          <h1 className="font-syne text-2xl sm:text-3xl font-extrabold tracking-[-0.5px] truncate">
            {startupName}
          </h1>
          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${badgeStyle}`}>
            <BadgeIcon className="h-2.5 w-2.5" />
            {badgeText}
          </span>
        </div>
        <p className="text-muted-foreground text-xs mb-1">
          Founder <span className="font-medium text-foreground">{displayName || userName}</span>
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
          {message}
        </p>
      </div>
      <div className="shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
        <Link
          href={ctaLink}
          className={`inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${ctaStyle}`}
        >
          <CtaIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{ctaText}</span>
        </Link>
      </div>
    </div>
  );
}
