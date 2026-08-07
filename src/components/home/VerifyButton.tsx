"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getClientOAuthRedirect } from "@/lib/oauth-redirect";
import React from "react";

interface VerifyButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function VerifyButton({ className, children }: VerifyButtonProps) {
  const router = useRouter();

  const handleVerifyClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      const { data: startups } = await supabase
        .from("startup_submissions")
        .select("slug")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (startups && startups.length > 0) {
        router.push(`/startup/${encodeURIComponent(startups[0].slug)}/verify`);
      } else {
        router.push("/submit");
      }
    } else {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getClientOAuthRedirect("/auth/callback"),
        },
      });
    }
  };

  return (
    <Link href="/submit" onClick={handleVerifyClick} className={className}>
      {children}
    </Link>
  );
}
