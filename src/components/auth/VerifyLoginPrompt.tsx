"use client";

import { supabase } from "@/lib/supabase";
import { getClientOAuthRedirect } from "@/lib/oauth-redirect";

interface VerifyLoginPromptProps {
  slug: string;
}

export function VerifyLoginPrompt({ slug }: VerifyLoginPromptProps) {
  const handleLogin = async () => {
    const next = `/startup/${encodeURIComponent(slug)}/verify`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: process.env.NODE_ENV === "production" ? "https://www.verifii.in/auth/callback" : "http://localhost:3000/auth/callback",
      },
    });
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-[#a8e630]"
    >
      Sign in with Google
    </button>
  );
}
