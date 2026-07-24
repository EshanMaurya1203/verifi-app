/**
 * Core type definitions for the Verifii Brand Design System.
 *
 * Establishes strong typing across configuration, asset locations,
 * design tokens, typography, and email system properties.
 */

export interface BrandCompanyConfig {
  name: string;
  legalName: string;
  tagline: string;
  copyright: string;
}

export interface BrandUrlsConfig {
  website: string;
  dashboard: string;
  supportEmail: string;
  privacy: string;
  terms: string;
  social: {
    twitter: string;
    linkedin: string;
    github: string;
    discord: string;
  };
}

export interface BrandAssetsConfig {
  logo: {
    horizontal: {
      transparent: string;
      solid: string;
    };
    square: {
      transparent: string;
      solid: string;
    };
  };
  favicons: {
    ico: string;
    icon16: string;
    icon32: string;
    icon48: string;
    icon180: string;
    icon192: string;
    icon512: string;
    appleTouchIcon: string;
  };
}

export interface BrandColors {
  /** Primary brand color (Lime Green) - maps to --primary in globals.css */
  primary: string;
  /** Primary hover state color */
  primaryHover: string;
  /** Primary dim accent background - maps to --accent in globals.css */
  primaryDim: string;
  /** Secondary background - maps to --secondary in globals.css */
  secondary: string;
  /** Success status color */
  success: string;
  /** Success dim accent background */
  successDim: string;
  /** Warning status color */
  warning: string;
  /** Warning dim accent background */
  warningDim: string;
  /** Danger status color */
  danger: string;
  /** Danger dim accent background */
  dangerDim: string;
  /** Application base background - maps to --background in globals.css */
  background: string;
  /** Card & popover surface background - maps to --card in globals.css */
  surface: string;
  /** Elevated card/surface level 2 - maps to --bg-2 / --bg-3 */
  surfaceElevated: string;
  /** Border color - maps to --border in globals.css */
  border: string;
  /** Secondary subtle border */
  borderSubtle: string;
  /** Text primary - maps to --foreground / --text in globals.css */
  textPrimary: string;
  /** Text secondary - maps to --text-2 / --muted-foreground */
  textSecondary: string;
  /** Muted text - maps to --text-3 */
  textMuted: string;
  /** High-contrast text on primary brand green background */
  buttonText: string;
}

export interface FontDefinition {
  family: string;
  weights: Record<string, number>;
}

export interface TypographyScale {
  fonts: {
    heading: string;
    body: string;
    mono: string;
  };
  sizes: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    "2xl": string;
    "3xl": string;
  };
  lineHeights: {
    tight: string;
    snug: string;
    normal: string;
    relaxed: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    "2xl": string;
  };
}

export interface EmailBrandConfig {
  fromAddress: string;
  replyTo: string;
  subjectPrefix: string;
  headerLogo: {
    url: string;
    altText: string;
    width: number;
    height: number;
  };
  footer: {
    companyLine: string;
    canSpamNotice: string;
    copyright: string;
    links: Array<{
      label: string;
      url: string;
    }>;
  };
}

export interface BrandConfig {
  company: BrandCompanyConfig;
  urls: BrandUrlsConfig;
  assets: BrandAssetsConfig;
}
