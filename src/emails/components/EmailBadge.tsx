/**
 * Status Badge component for Verifii transactional emails.
 *
 * Renders a compact, pill-shaped status indicator (e.g., Verified, Pending,
 * Failed) using brand-consistent colors for each status variant.
 */

import { Text } from "@react-email/components";
import * as React from "react";
import { brandColors, brandTypography } from "@/lib/branding";

type BadgeVariant = "success" | "warning" | "danger" | "neutral" | "primary";

interface EmailBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, { bg: string; color: string }> = {
  success: { bg: brandColors.success, color: "#ffffff" },
  warning: { bg: brandColors.warning, color: "#1a1a1a" },
  danger: { bg: brandColors.danger, color: "#ffffff" },
  neutral: { bg: brandColors.surfaceElevated, color: brandColors.textSecondary },
  primary: { bg: brandColors.primary, color: brandColors.buttonText },
};

export function EmailBadge({ children, variant = "neutral" }: EmailBadgeProps) {
  const styles = variantStyles[variant];

  return (
    <Text
      style={{
        display: "inline-block",
        backgroundColor: styles.bg,
        color: styles.color,
        fontSize: brandTypography.sizes.xs,
        fontWeight: 600,
        fontFamily: brandTypography.fonts.body,
        lineHeight: "1",
        padding: "4px 10px",
        borderRadius: "12px",
        margin: "0",
        textTransform: "uppercase" as const,
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </Text>
  );
}
