"use client";

import React, { useState } from "react";
import { Copy, Check, Code, Image as ImageIcon } from "lucide-react";
import { getBaseUrl } from "@/lib/url";

interface BadgeEmbedderProps {
  startupName: string;
  slug: string;
}

export function BadgeEmbedder({ startupName, slug }: BadgeEmbedderProps) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [copied, setCopied] = useState(false);
  const [baseUrl] = useState(() => typeof window !== "undefined" ? getBaseUrl() : "");

  const badgeUrl = `${baseUrl}/api/badge/${slug}?theme=${theme}`;
  const profileUrl = `${baseUrl}/startup/${slug}`;
  
  const embedCode = `<a href="${profileUrl}" target="_blank">
  <img src="${badgeUrl}" alt="${startupName} Verified on Verifi" width="300" height="80" />
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

  return (
    <div className="bg-neutral-900/50 border border-white/5 rounded-3xl overflow-hidden">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Trust Badge</h3>
          <p className="text-neutral-400 text-xs">Embed your verification status on your website or docs.</p>
        </div>
        <div className="flex bg-neutral-950 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setTheme("dark")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              theme === "dark" ? "bg-white/10 text-white" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Dark
          </button>
          <button
            onClick={() => setTheme("light")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              theme === "light" ? "bg-white text-neutral-950" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Light
          </button>
        </div>
      </div>

      <div className="p-8 flex flex-col items-center justify-center bg-neutral-950/30 min-h-[160px]">
        <div className="relative group">
          <img 
            src={badgeUrl} 
            alt="Badge Preview" 
            className="shadow-2xl rounded-2xl transition-transform group-hover:scale-[1.02] duration-300"
          />
          <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-neutral-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">HTML Snippet</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors text-[10px] font-black uppercase tracking-widest"
          >
            {copied ? (
              <><Check className="w-3.5 h-3.5" /> Copied</>
            ) : (
              <><Copy className="w-3.5 h-3.5" /> Copy Code</>
            )}
          </button>
        </div>

        <div className="relative group">
          <pre className="bg-neutral-950 border border-white/10 rounded-2xl p-4 text-[11px] text-neutral-400 font-mono overflow-x-auto whitespace-pre">
            {embedCode}
          </pre>
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/50 to-transparent pointer-events-none rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="flex items-center gap-2 px-2 pt-2 text-[9px] font-medium text-neutral-600 italic">
          <ImageIcon className="w-3 h-3" />
          Note: The badge updates automatically as your verification status changes.
        </div>
      </div>
    </div>
  );
}
