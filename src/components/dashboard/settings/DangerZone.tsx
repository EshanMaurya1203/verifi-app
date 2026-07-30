"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getClientOAuthRedirect } from "@/lib/oauth-redirect";
import { createReauthIntentAction } from "@/app/dashboard/settings/actions";

interface DangerZoneProps {
  userEmail: string;
  startups: { id: string; startup_name: string }[];
}

export function DangerZone({ userEmail, startups }: DangerZoneProps) {
  const [reauthenticatingAction, setReauthenticatingAction] = useState<string | null>(null);
  const [startupConfirmTexts, setStartupConfirmTexts] = useState<Record<string, string>>({});
  const [accountConfirmText, setAccountConfirmText] = useState("");

  const handleInitiateReauth = async (action: string) => {
    try {
      setReauthenticatingAction(action);
      
      // Request server-signed intent token (ENCRYPTION_SECRET stays exclusively on the server)
      const res = await createReauthIntentAction(action);
      if (!res.success || !res.intentToken) {
        throw new Error(res.error || "Failed to generate security re-authentication intent.");
      }

      const redirectUri = getClientOAuthRedirect(
        `/auth/callback/reauth?intent=${encodeURIComponent(res.intentToken)}`
      );

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          queryParams: {
            prompt: "select_account",
            ...(userEmail ? { login_hint: userEmail } : {}),
          },
          redirectTo: redirectUri,
        },
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate Google re-authentication.");
      setReauthenticatingAction(null);
    }
  };

  const handleDeleteStartup = async (startupId: string, startupName: string) => {
    const typedText = (startupConfirmTexts[startupId] || "").trim();
    if (typedText !== startupName) {
      toast.error(`Please type "${startupName}" to confirm deletion.`);
      return;
    }
    
    await handleInitiateReauth(`delete-startup:${startupId}`);
  };

  const handleDeleteAccount = async () => {
    if (accountConfirmText.trim() !== "DELETE") {
      toast.error('Please type "DELETE" to confirm account deletion.');
      return;
    }

    await handleInitiateReauth("delete-account");
  };

  return (
    <div className="space-y-8">
      <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-3xl space-y-8">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-red-500 mb-1">
            <AlertTriangle className="w-5 h-5" /> Danger Zone
          </h3>
          <p className="text-sm text-red-400 mb-6">
            These actions are irreversible. Please proceed with caution.
          </p>
        </div>

        {startups.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-bold text-white">Delete Startup Profiles</h4>
            {startups.map((s) => {
              const actionKey = `delete-startup:${s.id}`;
              const isReauthenticating = reauthenticatingAction === actionKey;
              return (
                <div key={s.id} className="bg-neutral-950 p-4 rounded-xl border border-red-500/20">
                  <div className="mb-4">
                    <p className="font-bold text-white">{s.startup_name}</p>
                    <p className="text-xs text-neutral-400">This will delete all verification data, connections, and public profile access.</p>
                  </div>
                  <div className="flex gap-4 items-center">
                    <input
                      type="text"
                      value={startupConfirmTexts[s.id] || ""}
                      onChange={(e) => setStartupConfirmTexts(prev => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder={`Type "${s.startup_name}"`}
                      className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 max-w-[280px]"
                    />
                    <button
                      onClick={() => handleDeleteStartup(s.id, s.startup_name)}
                      disabled={isReauthenticating || !!reauthenticatingAction}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 min-w-[100px] flex justify-center"
                    >
                      {isReauthenticating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-6 border-t border-red-500/20">
          <div className="mb-4">
            <h4 className="font-bold text-white">Delete Account</h4>
            <p className="text-xs text-neutral-400 mt-1">This will permanently delete your user account and all associated startups. This performs an atomic credentials wipe.</p>
          </div>
          <div className="flex gap-4 items-center">
            <input
              type="text"
              value={accountConfirmText}
              onChange={(e) => setAccountConfirmText(e.target.value)}
              placeholder='Type "DELETE"'
              className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 max-w-[280px]"
            />
            <button
              onClick={handleDeleteAccount}
              disabled={reauthenticatingAction === "delete-account" || !!reauthenticatingAction}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 min-w-[150px] flex justify-center"
            >
              {reauthenticatingAction === "delete-account" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Delete Account"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
