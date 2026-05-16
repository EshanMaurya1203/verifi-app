"use client";

import React, { useState, useEffect } from "react";
import { Share2, Link as LinkIcon, Check } from "lucide-react";
import { FaLinkedin, FaXTwitter } from "react-icons/fa6";
import { getBaseUrl } from "@/lib/url";

interface ShareVerificationButtonProps {
  startupName: string;
  slug: string;
  trustScore: number;
}

export function ShareVerificationButton({ startupName, slug, trustScore }: ShareVerificationButtonProps) {
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

  let trustTier = "Active Audit";
  if (trustScore > 85) trustTier = "Forensic Grade";
  else if (trustScore > 65) trustTier = "High Integrity";

  const shareText = `Transparency is our strongest signal. We just opened our financial audit on @Verifi — check out ${startupName}'s verified revenue profile:`;

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

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
      >
        <Share2 className="w-3.5 h-3.5" /> Share Verification
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 bottom-full mb-3 w-64 bg-neutral-900 border border-white/10 rounded-[2rem] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 backdrop-blur-xl">
            <div className="p-5">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-500 mb-4 px-2">
                Broadcast Integrity
              </p>
              
              <div className="space-y-2">
                <button 
                  onClick={handleCopy}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] rounded-2xl text-[11px] font-bold text-neutral-300 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <LinkIcon className={`w-4 h-4 ${copied ? 'text-emerald-400' : 'text-neutral-500 group-hover:text-neutral-300'}`} />
                    <span>{copied ? "Copied to clipboard" : "Copy Profile Link"}</span>
                  </div>
                  {copied && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>

                <button 
                  onClick={handleTwitterShare}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] rounded-2xl text-[11px] font-bold text-neutral-300 transition-all group"
                >
                  <FaXTwitter className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
                  <span>Share on X / Twitter</span>
                </button>

                <button 
                  onClick={handleLinkedInShare}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] rounded-2xl text-[11px] font-bold text-neutral-300 transition-all group"
                >
                  <FaLinkedin className="w-4 h-4 text-blue-500/50 group-hover:text-blue-400 transition-colors" />
                  <span>Post to LinkedIn</span>
                </button>
              </div>
            </div>
            
            <div className="px-5 py-3 bg-white/[0.02] border-t border-white/[0.05]">
              <p className="text-[8px] font-medium text-neutral-600 text-center uppercase tracking-widest">
                Verification status: <span className="text-indigo-400 font-bold">{trustTier}</span>
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
