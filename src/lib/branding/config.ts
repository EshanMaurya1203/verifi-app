/**
 * Central Brand Configuration for Verifii.
 *
 * Single Source of Truth (SSOT) for company metadata, URLs, social links,
 * and production logo & icon asset paths across the application.
 */

import type { BrandConfig } from "./types";

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.verifii.in");

export const brandConfig: BrandConfig = {
  company: {
    name: "Verifii",
    legalName: "Verifii Technologies Inc.",
    tagline: "Verified Startup Revenue for Indian Founders",
    copyright: `© ${new Date().getFullYear()} Verifii. All rights reserved.`,
  },
  urls: {
    website: APP_BASE_URL,
    dashboard: `${APP_BASE_URL}/dashboard`,
    supportEmail: "support@verifii.in",
    privacy: `${APP_BASE_URL}/privacy`,
    terms: `${APP_BASE_URL}/terms`,
    social: {
      twitter: "https://twitter.com/verifii",
      linkedin: "https://linkedin.com/company/verifii",
      github: "https://github.com/verifii",
      discord: "https://discord.gg/verifii",
    },
  },
  assets: {
    logo: {
      horizontal: {
        transparent: `${APP_BASE_URL}/branding/assets/logo-horizontal-transparent.png`,
        solid: `${APP_BASE_URL}/branding/assets/logo-horizontal-solid.png`,
      },
      square: {
        transparent: `${APP_BASE_URL}/branding/assets/logo-square-transparent.png`,
        solid: `${APP_BASE_URL}/branding/assets/logo-square-solid.png`,
      },
    },
    favicons: {
      ico: `${APP_BASE_URL}/branding/assets/favicon.ico`,
      icon16: `${APP_BASE_URL}/branding/assets/favicon-16.png`,
      icon32: `${APP_BASE_URL}/branding/assets/favicon-32.png`,
      icon48: `${APP_BASE_URL}/branding/assets/favicon-48.png`,
      icon180: `${APP_BASE_URL}/branding/assets/favicon-180.png`,
      icon192: `${APP_BASE_URL}/branding/assets/favicon-192.png`,
      icon512: `${APP_BASE_URL}/branding/assets/favicon-512.png`,
      appleTouchIcon: `${APP_BASE_URL}/branding/assets/apple-touch-icon.png`,
    },
  },
};
