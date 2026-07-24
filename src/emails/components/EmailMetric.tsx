/**
 * Metric Display Card for Verifii transactional emails.
 *
 * Renders a centered, prominent metric (e.g., verification score, revenue
 * figure) with a small label above and optional suffix.
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";
import { brandColors, brandTypography } from "@/lib/branding";

interface EmailMetricProps {
  label: string;
  value: string | number;
  suffix?: string;
}

export function EmailMetric({ label, value, suffix }: EmailMetricProps) {
  return (
    <Section
      style={{
        backgroundColor: brandColors.background,
        borderRadius: "8px",
        border: `1px solid ${brandColors.border}`,
        padding: "20px",
        textAlign: "center" as const,
        margin: "16px 0",
      }}
    >
      <Text
        style={{
          color: brandColors.textSecondary,
          fontSize: brandTypography.sizes.xs,
          fontWeight: 600,
          fontFamily: brandTypography.fonts.body,
          textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
          margin: "0 0 4px",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: brandColors.primary,
          fontSize: brandTypography.sizes["3xl"],
          fontWeight: 700,
          fontFamily: brandTypography.fonts.heading,
          lineHeight: brandTypography.lineHeights.tight,
          margin: "0",
        }}
      >
        {value}
        {suffix && (
          <span
            style={{
              fontSize: brandTypography.sizes.lg,
              color: brandColors.textSecondary,
            }}
          >
            {suffix}
          </span>
        )}
      </Text>
    </Section>
  );
}
