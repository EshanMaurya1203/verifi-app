/**
 * Reusable Header component for Verifii transactional emails.
 *
 * Renders the official Horizontal Transparent Logo centered at ~170px width,
 * maintaining aspect ratio and proper spacing.
 */

import { Section, Img } from "@react-email/components";
import * as React from "react";
import { emailBrandConfig } from "@/lib/branding";

export function EmailHeader() {
  const { headerLogo } = emailBrandConfig;

  return (
    <Section style={{ textAlign: "center" as const, marginBottom: "32px" }}>
      <Img
        src={headerLogo.url}
        alt={headerLogo.altText}
        width={headerLogo.width}
        height={headerLogo.height}
        style={{ display: "inline-block", margin: "0 auto" }}
      />
    </Section>
  );
}
