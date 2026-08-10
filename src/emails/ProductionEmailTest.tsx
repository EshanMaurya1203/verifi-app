import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";
import * as React from "react";
import { ProductionEmailTestEmailProps } from "@/notifications/email/types";

export const defaultSubject = "[Verifii] Production Email Infrastructure Test";

export default function ProductionEmailTestEmail({
  adminName = "Administrator",
  environment = "production",
  timestampFormatted = new Date().toUTCString(),
}: ProductionEmailTestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verifii Production Email Delivery Pipeline Verification</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Email Pipeline Verification</Heading>
          <Text style={paragraph}>Hello {adminName},</Text>
          <Text style={paragraph}>
            This is a temporary transactional test email dispatched to verify the 
            Verifii production Resend delivery pipeline for Launch Evidence Gate 1.
          </Text>
          
          <Section style={box}>
            <Text style={boxTitle}>Dispatch Details</Text>
            <Text style={boxText}><strong>Environment:</strong> {environment}</Text>
            <Text style={boxText}><strong>Timestamp:</strong> {timestampFormatted}</Text>
            <Text style={boxText}><strong>Provider:</strong> Resend API</Text>
            <Text style={boxText}><strong>Architecture:</strong> Notification Dispatcher → Resend Provider</Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Verifii Revenue Verification Platform • Temporary Launch Gate 1 Test Email
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#09090b",
  color: "#f4f4f5",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "40px 20px",
  maxWidth: "560px",
};

const heading = {
  fontSize: "24px",
  letterSpacing: "-0.5px",
  lineHeight: "1.3",
  fontWeight: "600",
  color: "#ffffff",
  padding: "17px 0 0",
};

const paragraph = {
  margin: "0 0 15px",
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#a1a1aa",
};

const box = {
  padding: "20px",
  backgroundColor: "#18181b",
  borderRadius: "8px",
  border: "1px solid #27272a",
  margin: "20px 0",
};

const boxTitle = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#ffffff",
  margin: "0 0 10px",
};

const boxText = {
  fontSize: "13px",
  color: "#a1a1aa",
  margin: "4px 0",
};

const hr = {
  borderColor: "#27272a",
  margin: "30px 0 20px",
};

const footer = {
  fontSize: "12px",
  color: "#71717a",
  textAlign: "center" as const,
};
