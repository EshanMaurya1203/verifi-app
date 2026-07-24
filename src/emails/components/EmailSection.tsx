/**
 * Section Layout wrapper for structured email template sections.
 */

import { Section } from "@react-email/components";
import * as React from "react";

interface EmailSectionProps {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  margin?: string;
}

export function EmailSection({
  children,
  align = "left",
  margin = "16px 0",
}: EmailSectionProps) {
  return (
    <Section
      style={{
        textAlign: align,
        margin,
      }}
    >
      {children}
    </Section>
  );
}
