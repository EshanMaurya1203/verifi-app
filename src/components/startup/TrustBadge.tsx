"use client";

import React from "react";
import { VERIFICATION_TIER_CONFIG } from "@/lib/verification-config";
import { ConfidenceTier } from "@/lib/verification-state";

interface TrustBadgeProps {
  tier: ConfidenceTier;
  className?: string;
  showGlow?: boolean;
  size?: "sm" | "md" | "lg";
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({ 
  tier, 
  className = "", 
  showGlow = false,
  size = "md" 
}) => {
  const config = VERIFICATION_TIER_CONFIG[tier] || VERIFICATION_TIER_CONFIG.SELF_REPORTED;
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2.5 py-1 text-[9px] gap-1.5 rounded-lg",
    md: "px-3 py-1.5 text-[10px] gap-2 rounded-xl",
    lg: "px-4 py-2 text-xs gap-2.5 rounded-2xl",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  return (
    <div 
      className={`inline-flex items-center font-bold uppercase tracking-wider border backdrop-blur-md transition-all ${config.color} ${config.bg} ${config.border} ${showGlow ? config.glow : ""} ${sizeClasses[size]} ${className}`}
      title={config.description}
    >
      <Icon className={iconSizes[size]} />
      <span>{config.label}</span>
    </div>
  );
};
