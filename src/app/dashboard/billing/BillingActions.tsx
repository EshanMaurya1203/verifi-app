"use client";

import { useState } from "react";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface BillingActionsProps {
  currentPlanCode: string;
  currentCycle: "monthly" | "annual";
  status: string;
}

export function BillingActions({ currentPlanCode, currentCycle, status }: BillingActionsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const router = useRouter();

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel? You will keep access until the end of your billing period.")) {
      return;
    }
    
    setIsCancelling(true);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST"
      });
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || "Failed to cancel subscription");
      } else {
        alert("Subscription cancelled successfully. It will remain active until the end of the billing period.");
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred.");
    } finally {
      setIsCancelling(false);
    }
  };

  const isFree = currentPlanCode === "viewer";

  return (
    <div className="space-y-4 font-sans">
      {isFree ? (
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            You are currently on the free Viewer plan. Upgrade to Founder or Pro to verify your revenue.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-[#a8e630] transition-colors"
          >
            Upgrade Plan
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-[#a8e630] transition-colors"
          >
            Change Plan
          </button>
          
          {status !== "cancelled" && status !== "expired" && (
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="rounded-xl border border-border bg-transparent px-6 py-2.5 text-sm font-bold text-red-500 hover:bg-red-500/10 hover:border-red-500/20 transition-all flex items-center gap-2"
            >
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel Subscription"}
            </button>
          )}
        </div>
      )}

      <UpgradeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentPlanCode={currentPlanCode}
        currentCycle={currentCycle}
      />
    </div>
  );
}
