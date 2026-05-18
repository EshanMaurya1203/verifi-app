"use client";

import React, { useState, useEffect } from "react";
import { Share2, Link as LinkIcon, Check } from "lucide-react";
import { FaLinkedin, FaXTwitter } from "react-icons/fa6";
import { getBaseUrl } from "@/lib/url";

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

  useEffect(() => {
    // Generate absolute URL securely on the client
    setShareUrl(`${getBaseUrl()}/startup/${slug}`);
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
    if (confidenceTier === "HIGH_CONFIDENCE") trustTier = "High Confidence";
    else if (confidenceTier === "REVENUE_VERIFIED") trustTier = "Revenue Verified";
    else if (confidenceTier === "PAYMENT_CONNECTED") trustTier = "Payment Connected";
    else trustTier = "Self Reported";
  } else if (trustScore !== undefined) {
    if (trustScore > 85) trustTier = "High Confidence";
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
  if (trustTier === "High Confidence") tierColorClass = "text-emerald-400 font-extrabold";
  else if (trustTier === "Revenue Verified") tierColorClass = "text-indigo-400 font-extrabold";
  else if (trustTier === "Payment Connected") tierColorClass = "text-amber-400 font-extrabold";

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#b9ff4b] hover:bg-[#b9ff4b]/95 text-[#080808] rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-lg shadow-[#b9ff4b]/15"
      >
        <Share2 className="w-3.5 h-3.5" /> Share Verification
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 bottom-full mb-3 w-64 bg-[#0f0f0f] border border-white/[0.08] rounded-[1.5rem] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 backdrop-blur-xl">
            <div className="p-5">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400 mb-4 px-2">
                Share Profile
              </p>
              
              <div className="space-y-2">
                <button 
                  onClick={handleCopy}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] rounded-xl text-[11px] font-bold text-neutral-300 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <LinkIcon className={`w-4 h-4 ${copied ? 'text-emerald-400' : 'text-neutral-400 group-hover:text-neutral-200'}`} />
                    <span>{copied ? "Copied to clipboard" : "Copy Profile Link"}</span>
                  </div>
                  {copied && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>

                <button 
                  onClick={handleTwitterShare}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] rounded-xl text-[11px] font-bold text-neutral-300 transition-all group"
                >
                  <FaXTwitter className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
                  <span>Share on X / Twitter</span>
                </button>

                <button 
                  onClick={handleLinkedInShare}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] rounded-xl text-[11px] font-bold text-neutral-300 transition-all group"
                >
                  <FaLinkedin className="w-4 h-4 text-blue-400/60 group-hover:text-blue-400 transition-colors" />
                  <span>Post to LinkedIn</span>
                </button>
              </div>
            </div>
            
            <div className="px-5 py-3 bg-white/[0.02] border-t border-white/[0.05]">
              <p className="text-[8px] font-medium text-neutral-400 text-center uppercase tracking-widest">
                Verification status: <span className={tierColorClass}>{trustTier}</span>
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
