"use client";

import { X } from "lucide-react";
import { PricingTable } from "./PricingTable";
import { useEffect } from "react";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlanCode?: string;
  currentCycle?: "monthly" | "annual";
}

export function UpgradeModal({
  isOpen,
  onClose,
  currentPlanCode,
  currentCycle,
}: UpgradeModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm sm:p-6">
      <div className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-background shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-2 bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>

        <div className="p-6 sm:p-10">
          <div className="text-center mb-10">
            <h2 className="font-syne text-3xl sm:text-4xl font-extrabold tracking-tight">
              Upgrade your <span className="text-primary">plan</span>
            </h2>
            <p className="mt-2 text-muted-foreground">
              Unlock advanced features and grow your verified startup.
            </p>
          </div>

          <PricingTable
            currentPlanCode={currentPlanCode}
            currentCycle={currentCycle}
            isModal={true}
            onCheckoutStart={() => {}}
            onCheckoutComplete={onClose}
          />
        </div>
      </div>
    </div>
  );
}
