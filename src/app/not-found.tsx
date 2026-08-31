import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { ShieldAlert, ArrowLeft, Search, Trophy } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page or startup profile you are looking for could not be found on Verifii.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-emerald-500/30 selection:text-emerald-400">
      <Navbar />

      <main className="relative flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-16">
        {/* Background glow effects */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-950/20 blur-[150px] rounded-full" />

        <div className="relative z-10 mx-auto max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-neutral-900/80 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl">
            <ShieldAlert className="h-10 w-10 text-emerald-400" />
          </div>

          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold tracking-wide text-emerald-400 uppercase">
            HTTP 404 — Not Found
          </div>

          <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Page Not Found
          </h1>

          <p className="mb-8 text-base text-neutral-400">
            The startup profile or page you requested does not exist, is private, or has been removed from the registry.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/leaderboard"
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition-all duration-200 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
            >
              <Trophy className="h-4 w-4" />
              Explore Leaderboard
            </Link>

            <Link
              href="/"
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-neutral-300 transition-all duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" />
              Return Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
