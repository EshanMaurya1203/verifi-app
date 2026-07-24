/**
 * Reusable Container Card for Verifii email layouts and highlight boxes.
 *
 * Provides a structured surface (#0f0f0f) with subtle borders and optional
 * status accent borders (e.g., success green or danger red).
 */

import { Section } from "@react-email/components";
import * as React from "react";
import { brandColors } from "@/lib/branding";

interface EmailCardProps {
  children: React.ReactNode;
  variant?: "default" | "elevated" | "success" | "danger" | "warning";
  padding?: string;
  margin?: string;
}

export function EmailCard({
  children,
  variant = "default",
  padding = "24px 28px",
  margin = "16px 0",
}: EmailCardProps) {
  let backgroundColor = brandColors.surface;
  const border = `1px solid ${brandColors.border}`;
  let borderLeft: string | undefined = undefined;

  switch (variant) {
    case "elevated":
      backgroundColor = brandColors.surfaceElevated;
      break;
    case "success":
      backgroundColor = brandColors.background;
      borderLeft = `3px solid ${brandColors.success}`;
      break;
    case "danger":
      backgroundColor = brandColors.background;
      borderLeft = `3px solid ${brandColors.danger}`;
      break;
    case "warning":
      backgroundColor = brandColors.background;
      borderLeft = `3px solid ${brandColors.warning}`;
      break;
    default:
      break;
  }

  return (
    <Section
      style={{
        backgroundColor,
        borderRadius: "12px",
        border,
        borderLeft: borderLeft ?? border,
        padding,
        margin,
      }}
    >
      {children}
    </Section>
  );
}
