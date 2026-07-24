"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address.");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters long.");

export function AccountSettingsForm({ userEmail }: { userEmail: string }) {
  const [email, setEmail] = useState(userEmail || "");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }
    
    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      toast.success("Confirmation link sent to your new email. Please verify it.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update email.");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = passwordSchema.safeParse(password);
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }
    
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated successfully.");
      setPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-neutral-900/50 border border-white/5 p-6 rounded-3xl space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Email Address</h3>
          <p className="text-sm text-neutral-400 mb-4">
            Update the email address associated with your Verifii account.
          </p>
          <form onSubmit={handleUpdateEmail} className="flex gap-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-neutral-950 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors max-w-sm"
              placeholder="name@example.com"
            />
            <button
              type="submit"
              disabled={emailLoading || email === userEmail}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold tracking-widest uppercase transition-colors disabled:opacity-50 min-w-[120px] flex justify-center"
            >
              {emailLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update"}
            </button>
          </form>
        </div>

        <div className="pt-6 border-t border-white/5">
          <h3 className="text-lg font-bold text-white mb-1">Change Password</h3>
          <p className="text-sm text-neutral-400 mb-4">
            Update your password to keep your account secure.
          </p>
          <form onSubmit={handleUpdatePassword} className="flex gap-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 bg-neutral-950 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors max-w-sm"
              placeholder="New Password"
            />
            <button
              type="submit"
              disabled={passwordLoading || password.length === 0}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold tracking-widest uppercase transition-colors disabled:opacity-50 min-w-[120px] flex justify-center"
            >
              {passwordLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
