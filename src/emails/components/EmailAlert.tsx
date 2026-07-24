/**
 * Alert / Callout Box component for Verifii transactional emails.
 *
 * Renders a prominent callout section with a left status accent border
 * and optional label, useful for surfacing failure reasons, important
 * notices, or actionable warnings.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { brandColors, brandTypography } from "@/lib/branding";

type AlertVariant = "info" | "success" | "warning" | "danger";

interface EmailAlertProps {
  children: React.ReactNode;
  variant?: AlertVariant;
  label?: string;
}

const variantAccent: Record<AlertVariant, string> = {
  info: brandColors.primary,
  success: brandColors.success,
  warning: brandColors.warning,
  danger: brandColors.danger,
};

export function EmailAlert({
  children,
  variant = "info",
  label,
}: EmailAlertProps) {
  const accent = variantAccent[variant];

  return (
    <Section
      style={{
        backgroundColor: brandColors.background,
        borderRadius: "8px",
        border: `1px solid ${brandColors.border}`,
        borderLeft: `3px solid ${accent}`,
        padding: "16px 20px",
        margin: "16px 0",
      }}
    >
      {label && (
        <Text
          style={{
            color: brandColors.textSecondary,
            fontSize: brandTypography.sizes.xs,
            fontWeight: 600,
            fontFamily: brandTypography.fonts.body,
            textTransform: "uppercase" as const,
            letterSpacing: "0.08em",
            margin: "0 0 6px",
          }}
        >
          {label}
        </Text>
      )}
      <Text
        style={{
          color: brandColors.textPrimary,
          fontSize: brandTypography.sizes.sm,
          fontFamily: brandTypography.fonts.body,
          lineHeight: brandTypography.lineHeights.normal,
          margin: "0",
        }}
      >
        {children}
      </Text>
    </Section>
  );
}
