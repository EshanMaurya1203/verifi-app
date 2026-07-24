/**
 * Branded Call-To-Action (CTA) Button for Verifii transactional emails.
 *
 * Renders an accessible, mobile-friendly CTA button using the official brand green
 * background (#b9ff4b) and high-contrast dark text (#080808). Uses inline styles
 * for maximum email client compatibility.
 */

import { Button } from "@react-email/components";
import * as React from "react";
import { brandColors, brandTypography } from "@/lib/branding";

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
  align?: "left" | "center" | "right";
}

export function EmailButton({ href, children, align = "center" }: EmailButtonProps) {
  return (
    <Button
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: brandColors.primary,
        color: brandColors.buttonText,
        fontSize: brandTypography.sizes.sm,
        fontWeight: 600,
        fontFamily: brandTypography.fonts.body,
        textDecoration: "none",
        textAlign: align,
        borderRadius: "8px",
        padding: "12px 28px",
        lineHeight: brandTypography.lineHeights.snug,
      }}
    >
      {children}
    </Button>
  );
}
