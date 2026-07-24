/**
 * Centralized Typography Scale & Spacing Tokens for Verifii.
 *
 * Aligned with the font definitions in `globals.css` (Syne for headings,
 * DM Sans / system-ui for body text, monospaced for numbers/code).
 */

import type { TypographyScale } from "./types";

export const brandTypography: TypographyScale = {
  fonts: {
    heading: '"Syne", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    body: 'var(--font-dm-sans), "DM Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  sizes: {
    xs: "12px",
    sm: "14px",
    base: "15px",
    lg: "18px",
    xl: "22px",
    "2xl": "28px",
    "3xl": "36px",
  },
  lineHeights: {
    tight: "1.2",
    snug: "1.3",
    normal: "1.5",
    relaxed: "1.6",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    "2xl": "48px",
  },
};
