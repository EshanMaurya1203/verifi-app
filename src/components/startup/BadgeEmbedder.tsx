"use client";

import React, { useState, useEffect } from "react";
import { Copy, Check, Code, Image as ImageIcon } from "lucide-react";
import { getSiteUrl } from "@/lib/site-url";

interface BadgeEmbedderProps {
  startupName: string;
  slug: string;
}

const ErrorFallbackBadge = ({ startupName }: { startupName: string }) => {
  return (
    <svg width="300" height="80" viewBox="0 0 300 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="rounded-2xl border border-rose-500/30">
      <rect width="300" height="80" rx="16" fill="#0f0f11"/>
      <rect x="0.5" y="0.5" width="299" height="79" rx="15.5" stroke="rgba(244,63,94,0.2)"/>
      <rect x="20" y="20" width="40" height="40" rx="8" fill="#f43f5e" fillOpacity="0.1"/>
      <path d="M40 32V35C40 37.7614 37.7614 40 35 40H32C29.2386 40 27 37.7614 27 35V32C27 29.2386 29.2386 27 32 27H35C37.7614 27 40 29.2386 40 32Z" stroke="#f43f5e" strokeWidth="1.5"/>
      <circle cx="33.5" cy="33.5" r="1.5" fill="#f43f5e"/>
      <text x="75" y="32" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="800" fill="#f43f5e" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>{startupName}</text>
      <text x="75" y="52" fontFamily="Inter, sans-serif" fontSize="10" fontWeight="600" fill="#71717a" style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>Audit Temporarily Offline</text>
    </svg>
  );
};

const BadgeSkeleton = () => {
  return (
    <div className="w-[300px] h-[80px] rounded-2xl bg-neutral-900 border border-white/5 p-4 flex items-center gap-4 animate-pulse relative overflow-hidden shrink-0">
      {/* Left Icon square */}
      <div className="w-10 h-10 rounded-lg bg-neutral-800 shrink-0" />
      
      {/* Center text blocks */}
      <div className="flex-1 space-y-2">
        <div className="h-3 w-28 bg-neutral-800 rounded" />
        <div className="h-2 w-20 bg-neutral-800 rounded" />
      </div>
      
      {/* Right pill */}
      <div className="w-20 h-5 bg-neutral-800 rounded-full shrink-0" />
    </div>
  );
};

export function BadgeEmbedder({ startupName, slug }: BadgeEmbedderProps) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setMounted(true);
    setOrigin(typeof window !== 'undefined' && window.location.origin ? window.location.origin : getSiteUrl());
  }, []);

  const badgeUrl = `${origin || getSiteUrl()}/api/badge/${slug}?theme=${theme}`;
  const profileUrl = `${origin || getSiteUrl()}/startup/${slug}`;
  
  const embedCode = `<a href="${profileUrl}" target="_blank">
  <img src="${badgeUrl}" alt="${startupName} is Verified on Verifi" width="300" height="80" />
</a>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleThemeChange = (newTheme: "dark" | "light") => {
    if (theme === newTheme) return;
    setTheme(newTheme);
    setStatus("loading");
  };

  return (
    <div className="bg-[#0f0f0f]/80 border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/[0.02]">
      <div className="p-6 md:p-8 border-b border-white/[0.05] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white mb-1.5 uppercase tracking-widest flex items-center gap-2">
            <Code className="w-4 h-4 text-indigo-400" />
            Verification Badge
          </h3>
          <p className="text-neutral-500 text-xs">Embed live verification status on your site.</p>
        </div>
        <div className="flex bg-black p-1 rounded-xl border border-white/[0.08] w-full sm:w-auto">
          <button
            onClick={() => handleThemeChange("dark")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              theme === "dark" ? "bg-white/10 text-white shadow-md" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Dark
          </button>
          <button
            onClick={() => handleThemeChange("light")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              theme === "light" ? "bg-white text-neutral-950 shadow-md" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Light
          </button>
        </div>
      </div>

      <div className="p-8 flex flex-col items-center justify-center bg-black/40 min-h-[160px] w-full overflow-x-auto relative">
        {/* Fixed stable container dimensions to prevent layout shifts */}
        <div className="w-[300px] h-[80px] relative group select-none flex items-center justify-center shrink-0">
          
          {/* 1. Loading Skeleton */}
          {status === "loading" && <BadgeSkeleton />}

          {/* 2. Error Fallback */}
          {status === "error" && <ErrorFallbackBadge startupName={startupName} />}

          {/* 3. Dynamic Badge Image (rendered dynamically and hidden until fully loaded) */}
          {mounted && (
            <img 
              src={badgeUrl} 
              alt={`${startupName} Verification Badge Preview`}
              width="300"
              height="80"
              onLoad={() => setStatus("loaded")}
              onError={() => setStatus("error")}
              className={`shadow-xl rounded-2xl transition-transform group-hover:scale-[1.02] duration-300 ${
                status === "loaded" ? "block" : "hidden"
              }`}
            />
          )}
          
          {status === "loaded" && (
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />
          )}
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">HTML Snippet</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-500/20"
          >
            {copied ? (
              <><Check className="w-3.5 h-3.5" /> Copied</>
            ) : (
              <><Copy className="w-3.5 h-3.5" /> Copy Code</>
            )}
          </button>
        </div>

        <div className="relative group overflow-hidden rounded-xl border border-white/[0.08] bg-[#080808]">
          <pre className="p-4 text-[11px] text-neutral-300 font-mono overflow-x-auto whitespace-pre">
            {embedCode}
          </pre>
          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#080808] to-transparent pointer-events-none" />
        </div>

        <div className="flex items-start gap-2 pt-2 text-[10px] font-medium text-neutral-500 leading-relaxed">
          <ImageIcon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-600" />
          <span>Badge updates in real-time as your verification status or revenue tier changes.</span>
        </div>
      </div>
    </div>
  );
}
