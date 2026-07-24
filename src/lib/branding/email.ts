/**
 * Email-Specific Branding Configuration for Verifii.
 *
 * Contains metadata and configuration ONLY (sender identity, subject prefix,
 * default logo parameters, CAN-SPAM text, and footer link targets).
 *
 * Component styling (colors, padding, borders, radius) belongs strictly inside
 * React Email components in `src/emails/components/`.
 */

import { brandConfig } from "./config";
import type { EmailBrandConfig } from "./types";

export const emailBrandConfig: EmailBrandConfig = {
  fromAddress: `${brandConfig.company.name} <noreply@verifii.in>`,
  replyTo: brandConfig.urls.supportEmail,
  subjectPrefix: "Verifii | ",
  headerLogo: {
    url: brandConfig.assets.logo.horizontal.transparent,
    altText: brandConfig.company.name,
    width: 170,
    height: 40,
  },
  footer: {
    companyLine: `${brandConfig.company.name} · ${brandConfig.company.tagline}`,
    canSpamNotice: "You're receiving this email because you have a Verifii account.",
    copyright: brandConfig.company.copyright,
    links: [
      { label: "verifii.in", url: brandConfig.urls.website },
      { label: "Support", url: `mailto:${brandConfig.urls.supportEmail}` },
      { label: "Privacy Policy", url: brandConfig.urls.privacy },
      { label: "Terms", url: brandConfig.urls.terms },
    ],
  },
};
