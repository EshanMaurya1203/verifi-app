"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";

export function Navbar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-14 border-b border-[#1a1a1a] bg-[rgba(8,8,8,0.85)] backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-white transition-opacity hover:opacity-90"
        >
          <span className="font-syne text-[20px] font-bold tracking-tight">
            verifi
            <span className="ml-1 inline-block h-2 w-2 rounded-full bg-[#b9ff4b]" />
          </span>
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          <Link
            href="/leaderboard"
            className="text-sm text-[#606060] transition-colors hover:text-[#edede9]"
          >
            Leaderboard
          </Link>
          <Link
            href="/submit"
            className="rounded-md border border-[#b9ff4b] bg-transparent px-4 py-1.5 text-sm font-medium text-[#b9ff4b] transition-all duration-200 hover:bg-[#b9ff4b] hover:text-[#080808]"
          >
            Add your startup
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setIsMobileOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-md p-2 text-[#edede9] transition hover:bg-neutral-800/60 sm:hidden"
          aria-label="Open menu"
          aria-expanded={isMobileOpen}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div
        className={`sm:hidden overflow-hidden border-b border-neutral-800 bg-[rgba(8,8,8,0.92)] backdrop-blur-xl transition-all duration-200 ${
          isMobileOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex flex-col gap-3">
            <Link
              href="/leaderboard"
              onClick={() => setIsMobileOpen(false)}
              className="text-sm text-[#606060] transition-colors hover:text-[#edede9]"
            >
              Leaderboard
            </Link>
            <Link
              href="/submit"
              onClick={() => setIsMobileOpen(false)}
              className="inline-flex w-fit rounded-md border border-[#b9ff4b] bg-transparent px-4 py-1.5 text-sm font-medium text-[#b9ff4b] transition-all duration-200 hover:bg-[#b9ff4b] hover:text-[#080808]"
            >
              Add your startup
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
