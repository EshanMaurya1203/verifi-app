import { Globe, Lock, ShieldCheck, Activity, Clock, Shield, LineChart } from "lucide-react";
import React from "react";
import type { StartupStatus } from "@/lib/dashboard/startup-status";

interface StatusCardProps {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

function StatusCard({ title, value, icon, iconBg, iconColor }: StatusCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
            {title}
          </p>
          <div className="font-syne text-lg sm:text-xl font-bold truncate">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatusCardsProps {
  status: StartupStatus;
  trustTier: string | null;
}

export function StatusCards({ status, trustTier }: StatusCardsProps) {
  // 1. Startup Status
  const isPublic = status.publication === "public";
  const startupStatusLabel = isPublic ? "Public" : "Private";
  const startupStatusIcon = isPublic ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />;
  const startupStatusBg = isPublic ? "bg-emerald-500/10" : "bg-neutral-500/10";
  const startupStatusColor = isPublic ? "text-emerald-500" : "text-neutral-500";

  // 2. Verification Status
  let verificationLabel = "Pending";
  let verificationIcon = <Clock className="h-5 w-5" />;
  let verificationBg = "bg-neutral-500/10";
  let verificationColor = "text-neutral-500";

  if (status.verification === "verified") {
    verificationLabel = "Verified";
    verificationIcon = <ShieldCheck className="h-5 w-5" />;
    verificationBg = "bg-emerald-500/10";
    verificationColor = "text-emerald-500";
  } else if (status.verification === "pending") {
    verificationLabel = "In Progress";
    verificationIcon = <Activity className="h-5 w-5" />;
    verificationBg = "bg-blue-500/10";
    verificationColor = "text-blue-500";
  }

  // 3. Trust Score
  let formattedTrustTier: string;
  if (!trustTier || trustTier === "SELF_REPORTED" || trustTier === "UNVERIFIED") {
    if (status.verification === "verified" || status.verification === "pending") {
      formattedTrustTier = "Calculating…";
    } else {
      formattedTrustTier = "Pending";
    }
  } else {
    formattedTrustTier = trustTier.replace(/_/g, " ");
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      <StatusCard
        title="Startup Status"
        value={startupStatusLabel}
        icon={startupStatusIcon}
        iconBg={startupStatusBg}
        iconColor={startupStatusColor}
      />
      <StatusCard
        title="Verification"
        value={verificationLabel}
        icon={verificationIcon}
        iconBg={verificationBg}
        iconColor={verificationColor}
      />
      <StatusCard
        title="Trust Score"
        value={
          <span className="capitalize">{formattedTrustTier}</span>
        }
        icon={<Shield className="h-5 w-5" />}
        iconBg="bg-primary/10"
        iconColor="text-primary"
      />
      <StatusCard
        title="Revenue"
        value="—"
        icon={<LineChart className="h-5 w-5" />}
        iconBg="bg-purple-500/10"
        iconColor="text-purple-500"
      />
    </div>
  );
}
