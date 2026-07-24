/**
 * Standard Email Footer for Verifii transactional emails.
 *
 * Provides legal compliance (CAN-SPAM text), brand copyright, and essential link targets
 * (Website, Support Email, Privacy Policy, Terms of Service) using centralized
 * brand configuration.
 */

import { Section, Text, Link, Hr } from "@react-email/components";
import * as React from "react";
import { emailBrandConfig, brandColors, brandTypography } from "@/lib/branding";

export function EmailFooter() {
  const { footer } = emailBrandConfig;

  return (
    <Section style={{ marginTop: "32px", textAlign: "center" as const }}>
      <Hr
        style={{
          borderTop: `1px solid ${brandColors.border}`,
          margin: "0 0 20px",
        }}
      />

      <Text
        style={{
          color: brandColors.textSecondary,
          fontSize: brandTypography.sizes.xs,
          lineHeight: brandTypography.lineHeights.relaxed,
          margin: "0 0 8px",
          fontFamily: brandTypography.fonts.body,
        }}
      >
        {footer.companyLine}
      </Text>

      <Text
        style={{
          color: brandColors.textMuted,
          fontSize: brandTypography.sizes.xs,
          lineHeight: brandTypography.lineHeights.relaxed,
          margin: "0 0 8px",
          fontFamily: brandTypography.fonts.body,
        }}
      >
        {footer.links.map((link, idx) => (
          <React.Fragment key={link.url}>
            {idx > 0 && " · "}
            <Link
              href={link.url}
              style={{
                color: brandColors.primary,
                textDecoration: "underline",
              }}
            >
              {link.label}
            </Link>
          </React.Fragment>
        ))}
      </Text>

      <Text
        style={{
          color: brandColors.textMuted,
          fontSize: "11px",
          lineHeight: brandTypography.lineHeights.relaxed,
          margin: "12px 0 4px",
          fontFamily: brandTypography.fonts.body,
        }}
      >
        {footer.canSpamNotice}
      </Text>

      <Text
        style={{
          color: brandColors.textMuted,
          fontSize: "11px",
          lineHeight: brandTypography.lineHeights.relaxed,
          margin: "4px 0 0",
          fontFamily: brandTypography.fonts.body,
        }}
      >
        {footer.copyright}
      </Text>
    </Section>
  );
}
