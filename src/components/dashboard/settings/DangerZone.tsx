"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { safeFetch } from "@/lib/safe-network";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface DangerZoneProps {
  userEmail: string;
  startups: { id: string; startup_name: string }[];
}

export function DangerZone({ userEmail, startups }: DangerZoneProps) {
  const [deletingStartupId, setDeletingStartupId] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  
  const handleVerifyPassword = async () => {
    if (!password) {
      toast.error("Please enter your password to confirm.");
      return false;
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });
      if (error) {
        toast.error("Incorrect password.");
        return false;
      }
      return true;
    } catch {
      toast.error("Failed to verify password.");
      return false;
    }
  };

  const handleDeleteStartup = async (startupId: string, startupName: string) => {
    if (confirmText !== startupName) {
      toast.error("Startup name does not match.");
      return;
    }
    
    setDeletingStartupId(startupId);
    
    const verified = await handleVerifyPassword();
    if (!verified) {
      setDeletingStartupId(null);
      return;
    }

    try {
      const { ok, error } = await safeFetch(`/api/startup/${startupId}/delete`, {
        method: "DELETE",
      });
      if (!ok) throw error || new Error("Failed to delete startup");
      
      toast.success("Startup deleted successfully.");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete startup.");
      setDeletingStartupId(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE") {
      toast.error("Please type DELETE to confirm.");
      return;
    }
    
    setIsDeletingAccount(true);
    
    const verified = await handleVerifyPassword();
    if (!verified) {
      setIsDeletingAccount(false);
      return;
    }

    try {
      const { ok, error } = await safeFetch(`/api/account/delete`, {
        method: "DELETE",
      });
      if (!ok) throw error || new Error("Failed to delete account");
      
      toast.success("Account deleted successfully.");
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account.");
      setIsDeletingAccount(false);
    }
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
            {startups.map((s) => (
              <div key={s.id} className="bg-neutral-950 p-4 rounded-xl border border-red-500/20">
                <div className="mb-4">
                  <p className="font-bold text-white">{s.startup_name}</p>
                  <p className="text-xs text-neutral-400">This will delete all verification data, connections, and public profile access.</p>
                </div>
                <div className="flex gap-4 items-center">
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={`Type "${s.startup_name}"`}
                    className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 max-w-[250px]"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your Password"
                    className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 max-w-[200px]"
                  />
                  <button
                    onClick={() => handleDeleteStartup(s.id, s.startup_name)}
                    disabled={deletingStartupId === s.id}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 min-w-[100px] flex justify-center"
                  >
                    {deletingStartupId === s.id ? <Loader2 className="w-5 h-5 animate-spin" /> : "Delete"}
                  </button>
                </div>
              </div>
            ))}
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
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Type "DELETE"'
              className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 max-w-[250px]"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your Password"
              className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500 max-w-[200px]"
            />
            <button
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 min-w-[150px] flex justify-center"
            >
              {isDeletingAccount ? <Loader2 className="w-5 h-5 animate-spin" /> : "Delete Account"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
