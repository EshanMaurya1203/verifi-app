/**
 * Shared email layout wrapper for all Verifii transactional emails.
 *
 * Provides consistent branding, typography, and structure across every
 * template. All templates should wrap their body content with this
 * component to guarantee visual consistency.
 *
 * Consumes design tokens from `@/lib/branding` and delegates header/footer
 * rendering to dedicated shared components.
 */

import {
  Html,
  Head,
  Body,
  Container,
  Preview,
} from "@react-email/components";
import * as React from "react";
import { brandColors, brandTypography } from "@/lib/branding";
import { EmailHeader } from "./EmailHeader";
import { EmailFooter } from "./EmailFooter";
import { EmailCard } from "./EmailCard";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EmailLayoutProps {
  /** Hidden preview text shown in email clients before opening. */
  preview: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
      </Head>

      <Preview>{preview}</Preview>

      <Body
        style={{
          backgroundColor: brandColors.background,
          fontFamily: brandTypography.fonts.body,
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            maxWidth: "580px",
            margin: "0 auto",
            padding: "40px 20px",
          }}
        >
          {/* ── Header ─────────────────────────────────── */}
          <EmailHeader />

          {/* ── Content Card ────────────────────────────── */}
          <EmailCard padding="32px 28px" margin="0">
            {children}
          </EmailCard>

          {/* ── Footer ─────────────────────────────────── */}
          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
}
