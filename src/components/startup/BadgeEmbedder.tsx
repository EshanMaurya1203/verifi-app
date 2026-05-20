"use client";

import React, { useState, useEffect } from "react";
import { Copy, Check, Code, Image as ImageIcon, Share2, X, ExternalLink } from "lucide-react";
import { FaLinkedin, FaXTwitter } from "react-icons/fa6";
import { getStartupUrl, getBadgeUrl, getRelativeBadgeUrl } from "@/lib/site-url";

interface BadgeEmbedderProps {
  startupName: string;
  slug: string;
}

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
  const [copiedBadge, setCopiedBadge] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<"loading" | "loaded" | "unavailable">("loading");

  useEffect(() => {
    setMounted(true);
  }, []);

  const badgePreviewUrl = `${getRelativeBadgeUrl(slug)}?theme=${theme}`;
  const badgeEmbedUrl = `${getBadgeUrl(slug)}?theme=${theme}`;
  const profileUrl = getStartupUrl(slug);
  
  const embedCode = `<a href="${profileUrl}" target="_blank">
  <img src="${badgeEmbedUrl}" alt="${startupName} is Verified on Verifi" width="300" height="80" />
</a>`;

  const handleCopyBadge = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopiedBadge(true);
      setTimeout(() => setCopiedBadge(false), 2000);
    } catch (err) {
      console.error("Failed to copy badge embed code:", err);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const shareText = `Check out ${startupName}'s live verified revenue & metrics on Verifi. Verified data directly from billing source!`;

  const handleLinkedInShare = () => {
    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`;
    window.open(shareUrl, "_blank", "width=600,height=600");
  };

  const handleXShare = () => {
    const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`;
    window.open(shareUrl, "_blank", "width=600,height=400");
  };

  const handleThemeChange = (newTheme: "dark" | "light") => {
    if (theme === newTheme) return;
    setTheme(newTheme);
    setStatus("loading");
  };

  return (
    <div className="bg-[#09090b]/40 border border-white/[0.06] rounded-[2rem] overflow-hidden shadow-2xl backdrop-blur-md ring-1 ring-white/[0.01]">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.05]">
        <h3 className="text-xs font-bold text-white mb-1 uppercase tracking-widest flex items-center gap-2">
          <Share2 className="w-3.5 h-3.5 text-indigo-400" />
          Share & Badge Verification
        </h3>
        <p className="text-neutral-500 text-[10px]">Verify your metrics publicly and share your verified status.</p>
      </div>

      {/* Badge Preview Area */}
      <div className="py-5 px-4 flex flex-col items-center justify-center bg-black/20 min-h-[110px] w-full overflow-x-auto relative">
        <div className="w-[300px] h-[80px] relative group select-none flex items-center justify-center shrink-0">
          {(status === "loading" || status === "unavailable") && <BadgeSkeleton />}
          {mounted && status !== "unavailable" && (
            <img 
              src={badgePreviewUrl} 
              alt={`${startupName} Verification Badge Preview`}
              width="300"
              height="80"
              onLoad={() => setStatus("loaded")}
              onError={() => setStatus("unavailable")}
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

      {/* Action Suite Area */}
      <div className="p-4 space-y-3">
        {/* Row 1: Copy Badge & Share Profile (Primary Actions) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleCopyBadge}
            className="flex items-center justify-center gap-2 text-indigo-400 hover:text-white transition-all text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-2.5 rounded-xl border border-indigo-500/20 active:scale-[0.98] select-none shadow-md shadow-indigo-950/20"
          >
            {copiedBadge ? (
              <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!</>
            ) : (
              <><Code className="w-3.5 h-3.5" /> Copy Badge</>
            )}
          </button>
          
          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 text-[#b9ff4b] hover:text-white transition-all text-[10px] font-black uppercase tracking-wider bg-[#b9ff4b]/10 hover:bg-[#b9ff4b]/20 px-3 py-2.5 rounded-xl border border-[#b9ff4b]/20 active:scale-[0.98] select-none shadow-md shadow-lime-950/10"
          >
            {copiedLink ? (
              <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!</>
            ) : (
              <><Share2 className="w-3.5 h-3.5" /> Share Link</>
            )}
          </button>
        </div>

        {/* Row 2: Share on LinkedIn & Share on X (Secondary Actions) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleLinkedInShare}
            className="flex items-center justify-center gap-2 text-neutral-400 hover:text-white transition-all text-[9px] font-extrabold uppercase tracking-wider bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] px-3 py-2 rounded-xl active:scale-[0.98] select-none"
          >
            <FaLinkedin className="w-3.5 h-3.5 text-neutral-500 hover:text-white transition-colors" /> LinkedIn
          </button>
          
          <button
            onClick={handleXShare}
            className="flex items-center justify-center gap-2 text-neutral-400 hover:text-white transition-all text-[9px] font-extrabold uppercase tracking-wider bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] px-3 py-2 rounded-xl active:scale-[0.98] select-none"
          >
            <FaXTwitter className="w-3.5 h-3.5 text-neutral-500 hover:text-white transition-colors" /> Share on X
          </button>
        </div>

        {/* Expand trigger for developers */}
        <div className="pt-0.5 flex items-center justify-center">
          <button
            onClick={() => setShowAdvanced(true)}
            className="text-[9px] font-black uppercase tracking-widest text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-white/[0.02]"
          >
            Advanced Embed Options <ExternalLink className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Advanced Embed Options Modal */}
      {showAdvanced && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0d0d0f] border border-white/[0.08] rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-white/[0.05] flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <Code className="w-4 h-4 text-indigo-400" />
                  Advanced Embed Options
                </h4>
                <p className="text-neutral-500 text-[10px] mt-1">Copy and embed the dynamic status badge in your frontend app or docs.</p>
              </div>
              <button
                onClick={() => setShowAdvanced(false)}
                className="w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              
              {/* Theme Toggle inside Modal */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Badge Theme</span>
                <div className="flex bg-black p-1 rounded-xl border border-white/[0.08] shrink-0">
                  <button
                    onClick={() => handleThemeChange("dark")}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                      theme === "dark" ? "bg-white/10 text-white" : "text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => handleThemeChange("light")}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                      theme === "light" ? "bg-white text-neutral-950" : "text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    Light
                  </button>
                </div>
              </div>

              {/* Snippet box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">HTML Embed Code</span>
                  <button
                    onClick={handleCopyBadge}
                    className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors text-[9px] font-black uppercase tracking-widest bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-lg border border-indigo-500/20"
                  >
                    {copiedBadge ? (
                      <><Check className="w-3.5 h-3.5" /> Copied</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /> Copy Code</>
                    )}
                  </button>
                </div>

                <div className="relative group overflow-hidden rounded-xl border border-white/[0.08] bg-black p-4">
                  <pre className="text-[10px] text-neutral-400 font-mono overflow-x-auto whitespace-pre leading-relaxed select-all">
                    {embedCode}
                  </pre>
                  <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black to-transparent pointer-events-none" />
                </div>
              </div>

              {/* Hint message */}
              <div className="flex items-start gap-2.5 text-[9px] font-medium text-neutral-500 leading-relaxed bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl">
                <ImageIcon className="w-4 h-4 shrink-0 text-neutral-600" />
                <span>The badge uses your production-safe routing URL and automatically refreshes whenever your verified revenue is updated. No manual code updates required.</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-black/40 border-t border-white/[0.05] flex justify-end">
              <button
                onClick={() => setShowAdvanced(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors shadow-lg active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
