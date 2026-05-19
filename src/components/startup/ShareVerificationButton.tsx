"use client";

import React, { useState, useEffect, useRef } from "react";
import { Share2, Link as LinkIcon, Check, ShieldCheck, Globe } from "lucide-react";
import { FaLinkedin, FaXTwitter } from "react-icons/fa6";
import { getSiteUrl } from "@/lib/site-url";

interface ShareVerificationButtonProps {
  startupName: string;
  slug: string;
  trustScore?: number;
  confidenceTier?: string;
}

export function ShareVerificationButton({ startupName, slug, trustScore, confidenceTier }: ShareVerificationButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate absolute URL securely on the client to prevent localhost leakage
    const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : getSiteUrl();
    setShareUrl(`${origin}/startup/${slug}`);
  }, [slug]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Resolve active tier name beautifully
  let trustTier = "Self Reported";
  if (confidenceTier) {
    if (confidenceTier === "HIGH_CONFIDENCE") trustTier = "Payment Verified";
    else if (confidenceTier === "REVENUE_VERIFIED") trustTier = "Revenue Verified";
    else if (confidenceTier === "PAYMENT_CONNECTED") trustTier = "Payment Connected";
    else trustTier = "Self Reported";
  } else if (trustScore !== undefined) {
    if (trustScore > 85) trustTier = "Payment Verified";
    else if (trustScore > 65) trustTier = "Revenue Verified";
    else if (trustScore > 30) trustTier = "Payment Connected";
  }

  // Dynamic public share copy according to verification status
  const isVerified = trustTier !== "Self Reported";
  const shareText = isVerified
    ? `Transparency is our strongest signal. We just opened our verified revenue profile on @Verifi — check it out:`
    : `Transparency is our strongest signal. We just opened our startup trust profile on @Verifi — check it out:`;

  const handleTwitterShare = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank");
    setIsOpen(false);
  };

  const handleLinkedInShare = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank");
    setIsOpen(false);
  };

  // Resolve dynamic tier status color beautifully for high contrast UI
  let tierColorClass = "text-neutral-400";
  if (trustTier === "Payment Verified") tierColorClass = "text-emerald-400 font-extrabold";
  else if (trustTier === "Revenue Verified") tierColorClass = "text-indigo-400 font-extrabold";
  else if (trustTier === "Payment Connected") tierColorClass = "text-amber-400 font-extrabold";

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#b9ff4b] hover:bg-[#b9ff4b]/95 text-[#080808] rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-[0_0_20px_rgba(185,255,75,0.15)]"
      >
        <Globe className="w-3.5 h-3.5" /> Share Proof
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div 
            ref={dropdownRef}
            className="absolute right-0 bottom-full mb-3 w-[280px] bg-[#0f0f0f]/95 border border-white/[0.08] rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 backdrop-blur-xl ring-1 ring-white/[0.02]"
          >
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4 px-2">
                <Share2 className="w-4 h-4 text-indigo-400" />
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white">
                  Share Public Link
                </p>
              </div>
              
              <div className="space-y-2">
                <button 
                  onClick={handleCopy}
                  className="w-full flex items-center justify-between px-4 py-3.5 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] rounded-xl text-[11px] font-bold text-neutral-300 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <LinkIcon className={`w-4 h-4 ${copied ? 'text-emerald-400' : 'text-neutral-500 group-hover:text-indigo-400 transition-colors'}`} />
                    <span>{copied ? "Copied to clipboard" : "Copy Profile Link"}</span>
                  </div>
                  {copied && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>

                <button 
                  onClick={handleTwitterShare}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] rounded-xl text-[11px] font-bold text-neutral-300 transition-all group"
                >
                  <FaXTwitter className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
                  <span>Announce on X / Twitter</span>
                </button>

                <button 
                  onClick={handleLinkedInShare}
                  className="w-full flex items-center gap-3 px-4 py-3.5 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] rounded-xl text-[11px] font-bold text-neutral-300 transition-all group"
                >
                  <FaLinkedin className="w-4 h-4 text-neutral-500 group-hover:text-blue-400 transition-colors" />
                  <span>Post to LinkedIn</span>
                </button>
              </div>
            </div>
            
            <div className="px-5 py-4 bg-black/40 border-t border-white/[0.05] flex flex-col items-center justify-center">
              <div className="flex items-center gap-1.5 mb-1 text-neutral-500">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Current Status</span>
              </div>
              <p className={`text-[10px] uppercase tracking-widest ${tierColorClass}`}>
                {trustTier}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
