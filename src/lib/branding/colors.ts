/**
 * Centralized Design Token Colors for Verifii.
 *
 * Maps directly to the existing project design system defined in `globals.css`
 * and Tailwind CSS tokens (`--primary` #b9ff4b, `--background` #080808, `--card` #0f0f0f, `--border`).
 *
 * Ensures website, dashboard, transactional emails, and future channels consume
 * the exact same visual language.
 */

import type { BrandColors } from "./types";

export const brandColors: BrandColors = {
  // Primary Brand Lime-Green (#b9ff4b)
  primary: "#b9ff4b",
  primaryHover: "#a3e635",
  primaryDim: "#132200",
  secondary: "#18181c",

  // Functional Status Colors
  success: "#10b981",
  successDim: "rgba(16, 185, 129, 0.15)",
  warning: "#fbbf24",
  warningDim: "#2d1f00",
  danger: "#f87171",
  dangerDim: "rgba(248, 113, 113, 0.15)",

  // Background & Surfaces
  background: "#080808",
  surface: "#0f0f0f",
  surfaceElevated: "#18181c",

  // Borders
  border: "#262626",
  borderSubtle: "rgba(255, 255, 255, 0.08)",

  // Typography
  textPrimary: "#f3f3f5",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",

  // High contrast text on primary brand green elements
  buttonText: "#080808",
};
