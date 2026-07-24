/**
 * Reusable Typography Component for Verifii transactional emails.
 *
 * Provides standardized font sizing, colors, line heights, and margins
 * for headings, subheadings, body text, muted text, and captions.
 */

import { Heading, Text } from "@react-email/components";
import * as React from "react";
import { brandColors, brandTypography } from "@/lib/branding";

interface EmailTextProps {
  children: React.ReactNode;
  variant?: "heading" | "subheading" | "body" | "muted" | "caption";
  align?: "left" | "center" | "right";
  margin?: string;
}

export function EmailText({
  children,
  variant = "body",
  align = "left",
  margin,
}: EmailTextProps) {
  switch (variant) {
    case "heading":
      return (
        <Heading
          as="h1"
          style={{
            color: brandColors.textPrimary,
            fontSize: brandTypography.sizes.xl,
            fontWeight: 700,
            fontFamily: brandTypography.fonts.heading,
            lineHeight: brandTypography.lineHeights.snug,
            textAlign: align,
            margin: margin ?? "0 0 16px",
          }}
        >
          {children}
        </Heading>
      );

    case "subheading":
      return (
        <Heading
          as="h2"
          style={{
            color: brandColors.textPrimary,
            fontSize: brandTypography.sizes.lg,
            fontWeight: 600,
            fontFamily: brandTypography.fonts.heading,
            lineHeight: brandTypography.lineHeights.snug,
            textAlign: align,
            margin: margin ?? "0 0 12px",
          }}
        >
          {children}
        </Heading>
      );

    case "muted":
      return (
        <Text
          style={{
            color: brandColors.textSecondary,
            fontSize: brandTypography.sizes.base,
            fontFamily: brandTypography.fonts.body,
            lineHeight: brandTypography.lineHeights.relaxed,
            textAlign: align,
            margin: margin ?? "0 0 12px",
          }}
        >
          {children}
        </Text>
      );

    case "caption":
      return (
        <Text
          style={{
            color: brandColors.textMuted,
            fontSize: brandTypography.sizes.xs,
            fontFamily: brandTypography.fonts.body,
            lineHeight: brandTypography.lineHeights.normal,
            textAlign: align,
            margin: margin ?? "0 0 8px",
          }}
        >
          {children}
        </Text>
      );

    case "body":
    default:
      return (
        <Text
          style={{
            color: brandColors.textPrimary,
            fontSize: brandTypography.sizes.base,
            fontFamily: brandTypography.fonts.body,
            lineHeight: brandTypography.lineHeights.relaxed,
            textAlign: align,
            margin: margin ?? "0 0 12px",
          }}
        >
          {children}
        </Text>
      );
  }
}
