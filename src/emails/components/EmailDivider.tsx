/**
 * Standard Horizontal Rule / Divider for Verifii emails.
 */

import { Hr } from "@react-email/components";
import * as React from "react";
import { brandColors } from "@/lib/branding";

interface EmailDividerProps {
  margin?: string;
}

export function EmailDivider({ margin = "24px 0" }: EmailDividerProps) {
  return (
    <Hr
      style={{
        borderTop: `1px solid ${brandColors.border}`,
        borderBottom: "none",
        borderLeft: "none",
        borderRight: "none",
        margin,
      }}
    />
  );
}
