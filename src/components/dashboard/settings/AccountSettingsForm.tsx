"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address.");

export function AccountSettingsForm({ userEmail }: { userEmail: string }) {
  const [email, setEmail] = useState(userEmail || "");
  const [emailLoading, setEmailLoading] = useState(false);

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
      </div>
    </div>
  );
}

