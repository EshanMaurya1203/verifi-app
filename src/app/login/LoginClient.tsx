"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LogIn, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getClientOAuthRedirect } from "@/lib/oauth-redirect";

export function LoginClient() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const authError = searchParams.get("error");
  const [isLoading, setIsLoading] = useState(false);

  // Validate internal redirect destination, default to /dashboard for returning users
  const safeNext = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
    ? rawNext
    : "/dashboard";

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      const callbackPath = `/auth/callback?next=${encodeURIComponent(safeNext)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getClientOAuthRedirect(callbackPath),
        },
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      setIsLoading(false);
      console.error("[Login] OAuth error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#040406] text-white flex flex-col justify-between selection:bg-primary selection:text-[#080808]">
      {/* Header / Brand */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-white transition-opacity hover:opacity-90"
        >
          <span className="font-syne text-[20px] font-bold tracking-tight">
            verifii
            <span className="ml-1 inline-block h-2 w-2 rounded-full bg-primary" />
          </span>
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Return to platform
        </Link>
      </header>

      {/* Main Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[420px] p-8 sm:p-10 rounded-[2rem] bg-neutral-900/40 border border-white/5 relative overflow-hidden backdrop-blur-xl shadow-2xl">
          {/* Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full opacity-[0.07] bg-primary blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full opacity-[0.05] bg-primary blur-3xl pointer-events-none" />

          <div className="relative z-10 text-center">
            {/* Login Icon */}
            <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 shadow-inner">
              <LogIn className="h-6 w-6 text-primary" />
            </div>

            <h1 className="font-syne text-2xl sm:text-3xl font-extrabold tracking-[-0.5px] text-white mb-2">
              Welcome back
            </h1>

            <p className="text-xs font-medium text-neutral-400 leading-relaxed mb-6">
              Sign in to manage your startup profile, view verification metrics, and access your dashboard.
            </p>

            {/* Error Display */}
            {authError && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                  Authentication Issue
                </p>
                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                  {authError === "oauth_exchange_failed"
                    ? "OAuth authentication could not be completed. Please try again."
                    : authError === "missing_oauth_code"
                    ? "Authentication session expired or code was missing. Please try again."
                    : authError}
                </p>
              </div>
            )}

            {/* Google OAuth Action Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-white text-black hover:bg-neutral-200 transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-700" />
                  <span>Signing in with Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Auth Toggle Link */}
            <div className="mt-6 pt-5 border-t border-white/5 text-center text-xs text-neutral-400">
              Don&apos;t have an account?{" "}
              <Link
                href={rawNext ? `/signup?next=${encodeURIComponent(rawNext)}` : "/signup"}
                className="text-primary font-semibold hover:underline"
              >
                Create account
              </Link>
            </div>

            {/* Trust Footer Notice */}
            <p className="text-[10px] font-bold text-neutral-600 tracking-wider mt-6 uppercase">
              Secure authentication powered by Supabase
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
        <div>© {new Date().getFullYear()} Verifii</div>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-neutral-300 transition-colors">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-neutral-300 transition-colors">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}
