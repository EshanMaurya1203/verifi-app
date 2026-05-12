"use client";

import React, { useState, useEffect } from "react";
import { Share2, Link as LinkIcon, Check } from "lucide-react";
import { FaLinkedin, FaXTwitter } from "react-icons/fa6";

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
    setShareUrl(`${window.location.origin}/startup/${slug}`);
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

  const shareText = `${startupName} is verified on Verifi with ${trustTier} trust status.`;

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
        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
      >
        <Share2 className="w-4 h-4" /> Share Verification
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-neutral-900 border border-white/10 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2 px-2">
                Share Profile
              </p>
              
              <div className="space-y-1">
                <button 
                  onClick={handleCopy}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-xl text-xs font-semibold text-white transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <LinkIcon className="w-4 h-4 text-neutral-400" />
                  )}
                  {copied ? <span className="text-emerald-400">Copied!</span> : "Copy Link"}
                </button>

                <button 
                  onClick={handleTwitterShare}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-xl text-xs font-semibold text-white transition-colors"
                >
                  <FaXTwitter className="w-4 h-4 text-sky-400" />
                  Share on X (Twitter)
                </button>

                <button 
                  onClick={handleLinkedInShare}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-xl text-xs font-semibold text-white transition-colors"
                >
                  <FaLinkedin className="w-4 h-4 text-blue-500" />
                  Share on LinkedIn
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
