"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ArrowLeft, ShieldAlert } from "lucide-react";
import { safeFetch } from "@/lib/safe-network";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkReauthProofAction } from "@/app/dashboard/settings/actions";

interface ConfirmDeleteActionProps {
  action: string;
  userEmail: string;
  startupId?: string;
  startupName?: string;
}

export function ConfirmDeleteAction({
  action,
  userEmail,
  startupId,
  startupName,
}: ConfirmDeleteActionProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidProof, setIsValidProof] = useState(false);
  const [proofErrorMessage, setProofErrorMessage] = useState<string | undefined>();
  const router = useRouter();

  const isAccountDeletion = action === "delete-account";

  useEffect(() => {
    let isMounted = true;
    async function verifyProofPassive() {
      try {
        const result = await checkReauthProofAction(action);
        if (isMounted) {
          setIsValidProof(result.valid);
          setProofErrorMessage(result.reason);
        }
      } catch {
        if (isMounted) {
          setIsValidProof(false);
          setProofErrorMessage("Failed to verify security re-authentication proof.");
        }
      } finally {
        if (isMounted) {
          setIsVerifying(false);
        }
      }
    }

    verifyProofPassive();
    return () => {
      isMounted = false;
    };
  }, [action]);

  const handleConfirmDeletion = async () => {
    setIsDeleting(true);

    try {
      if (isAccountDeletion) {
        const { ok, error } = await safeFetch("/api/account/delete", {
          method: "DELETE",
        });
        if (!ok) throw error || new Error("Failed to delete account.");

        toast.success("Account deleted successfully.");
        await supabase.auth.signOut();
        window.location.href = "/";
      } else if (startupId) {
        const { ok, error } = await safeFetch(`/api/startup/${startupId}/delete`, {
          method: "DELETE",
        });
        if (!ok) throw error || new Error("Failed to delete startup.");

        toast.success("Startup deleted successfully.");
        window.location.href = "/dashboard/settings";
      } else {
        throw new Error("Invalid deletion target.");
      }
    } catch (err: any) {
      toast.error(err.message || "Deletion failed. Please try again.");
      setIsDeleting(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="max-w-xl mx-auto bg-neutral-900 border border-white/10 p-8 rounded-3xl text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-red-500" />
        <p className="text-sm font-semibold text-neutral-300">Verifying security re-authentication proof...</p>
      </div>
    );
  }

  if (!isValidProof) {
    return (
      <div className="max-w-xl mx-auto bg-neutral-900 border border-red-500/30 p-8 rounded-3xl space-y-6 text-center">
        <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-red-500">
          <ShieldAlert className="w-6 h-6" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-2">Re-authentication Required</h2>
          <p className="text-sm text-neutral-400">
            {proofErrorMessage || "The security re-authentication proof has expired or is invalid. Destructive actions require a recent identity confirmation."}
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-sm font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto bg-red-500/10 border border-red-500/30 p-8 rounded-3xl space-y-6">
      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full w-fit">
        <CheckCircle2 className="w-4 h-4" /> Identity Confirmed via Google OAuth ({userEmail})
      </div>

      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-red-500 mb-2">
          <AlertTriangle className="w-6 h-6" />
          {isAccountDeletion ? "Final Confirmation: Delete Account" : `Final Confirmation: Delete ${startupName || "Startup"}`}
        </h2>
        <p className="text-sm text-red-300">
          {isAccountDeletion
            ? "You are about to permanently delete your Verifii account. All startup profiles, verification data, connected integrations, and credentials will be permanently erased. This action cannot be undone."
            : `You are about to permanently delete the startup profile for "${startupName}". All verification metrics, revenue data, and public links for this startup will be permanently removed.`}
        </p>
      </div>

      <div className="p-4 bg-neutral-950/80 border border-red-500/20 rounded-xl space-y-2 text-xs text-neutral-400">
        <p className="font-semibold text-neutral-200">Security Verification Details:</p>
        <p>• Action target: {isAccountDeletion ? "Full Account Wipe" : `Startup ID ${startupId}`}</p>
        <p>• Authenticated user: {userEmail}</p>
        <p>• Proof status: Verified (Single-use security token consumed)</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-2">
        <button
          onClick={handleConfirmDeletion}
          disabled={isDeleting}
          className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isDeleting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Processing Deletion...
            </>
          ) : (
            `Yes, Permanently Delete ${isAccountDeletion ? "Account" : "Startup"}`
          )}
        </button>

        <button
          onClick={() => router.push("/dashboard/settings")}
          disabled={isDeleting}
          className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-white/10 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
