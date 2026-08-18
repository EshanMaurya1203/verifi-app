/**
 * A4.5 Step 4C — InvestorReportCard Component Test Suite
 *
 * Tests the InvestorReportCard UI component for structural invariants:
 * - Consumption of useInvestorReport hook
 * - ₹499 one-time price presentation (never subscription)
 * - State representations (idle, creating_order, payment_open, verifying, generating, completed, error)
 * - Demo startup gating
 * - Accessibility attributes (aria-busy, aria-disabled, aria-live)
 * - Zero direct Razorpay/Storage/Secret/Math leaks
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";

describe("A4.5 Step 4C — InvestorReportCard Component", () => {
  const cardPath = path.join(process.cwd(), "src/components/reports/InvestorReportCard.tsx");
  const cardExists = fs.existsSync(cardPath);
  const cardContent = cardExists ? fs.readFileSync(cardPath, "utf8") : "";

  it("TEST 1: InvestorReportCard file exists and exports InvestorReportCard component", () => {
    assert(cardExists, "InvestorReportCard.tsx must exist");
    assert(
      cardContent.includes("export function InvestorReportCard") ||
      cardContent.includes("export const InvestorReportCard"),
      "Must export InvestorReportCard"
    );
    assert(cardContent.includes('"use client"'), 'Must be a "use client" component');
  });

  it("TEST 2: ₹499 one-time price is displayed (not described as subscription or monthly)", () => {
    assert(cardContent.includes("₹499"), "Must display ₹499 price");
    assert(
      cardContent.includes("One-Time") || cardContent.includes("one-time"),
      "Must indicate One-Time purchase"
    );
    assert(
      !cardContent.includes("/month") && !cardContent.includes("/mo"),
      "Must NOT describe as monthly recurring charge"
    );
    assert(
      cardContent.includes("No subscription required"),
      "Must state no subscription required"
    );
  });

  it("TEST 3: CTA is rendered with clear action text", () => {
    assert(
      cardContent.includes("Generate Investor Report — ₹499") ||
      cardContent.includes("Generate Investor Report"),
      "Must render Generate Investor Report CTA"
    );
  });

  it("TEST 4: Clicking CTA invokes hook purchase action (startPurchase)", () => {
    assert(
      cardContent.includes("useInvestorReport"),
      "Must import and call useInvestorReport"
    );
    assert(
      cardContent.includes("startPurchase(startupId"),
      "Must invoke startPurchase with startupId"
    );
  });

  it("TEST 5: Creating-order state disables CTA and displays preparing checkout message", () => {
    assert(
      cardContent.includes('state === "creating_order"'),
      "Must check for creating_order state"
    );
    assert(
      cardContent.includes("Preparing Secure Checkout") ||
      cardContent.includes("Preparing secure checkout"),
      "Must display preparing checkout text"
    );
    assert(
      cardContent.includes("isBusy") && cardContent.includes("disabled={isBusy}"),
      "CTA must be disabled when isBusy"
    );
  });

  it("TEST 6: Payment-open state prevents duplicate purchase interaction", () => {
    assert(
      cardContent.includes('state === "payment_open"'),
      "Must check for payment_open state"
    );
    assert(
      cardContent.includes("Checkout Active") || cardContent.includes("checkout active"),
      "Must render checkout active state"
    );
  });

  it("TEST 7: Verifying state displays payment verification message (NOT claiming success prematurely)", () => {
    assert(
      cardContent.includes('state === "verifying"'),
      "Must check for verifying state"
    );
    assert(
      cardContent.includes("Payment received. Verifying your payment..."),
      "Must show exact verification message without premature success claim"
    );
  });

  it("TEST 8: Generating state displays generation-in-progress message", () => {
    assert(
      cardContent.includes('state === "generating"'),
      "Must check for generating state"
    );
    assert(
      cardContent.includes("Payment verified. Your Investor Report is being generated."),
      "Must show generation in progress message"
    );
  });

  it("TEST 9: Generating state exposes retryGeneration action", () => {
    const generatingBlock = cardContent.match(/state === "generating"[\s\S]*?<\/div>\s*\)/);
    assert(generatingBlock, "Must find generating state block");
    assert(
      generatingBlock[0].includes("retryGeneration"),
      "Generating state must provide retryGeneration button"
    );
  });

  it("TEST 10: Retry generation does not invoke startPurchase", () => {
    const generatingBlock = cardContent.match(/state === "generating"[\s\S]*?<\/div>\s*\)/);
    assert(generatingBlock, "Must find generating state block");
    assert(
      !generatingBlock[0].includes("startPurchase"),
      "Generating block must NOT invoke startPurchase"
    );
  });

  it("TEST 11: Completed state displays download action and status confirmation", () => {
    assert(
      cardContent.includes('state === "completed"'),
      "Must handle completed state"
    );
    assert(
      cardContent.includes("Investor Report Ready"),
      "Must indicate Investor Report Ready"
    );
    assert(
      cardContent.includes("Download Investor Report"),
      "Must render Download Investor Report button"
    );
  });

  it("TEST 12: Download uses server-provided signed URL (window.open with downloadUrl)", () => {
    assert(
      cardContent.includes("window.open(downloadUrl"),
      "Must trigger download via server-supplied downloadUrl"
    );
    assert(
      !cardContent.includes("createSignedUrl"),
      "Must NOT call createSignedUrl client-side"
    );
  });

  it("TEST 13: Error state displays safe error message from hook", () => {
    assert(
      cardContent.includes('state === "error"'),
      "Must handle error state"
    );
    assert(
      cardContent.includes("{error}"),
      "Must render error message"
    );
    assert(
      cardContent.includes("reset"),
      "Must provide dismiss/reset button in error state"
    );
  });

  it("TEST 14: Demo startup disables purchase CTA", () => {
    assert(
      cardContent.includes("isDemo"),
      "Must check isDemo prop"
    );
    assert(
      cardContent.includes("Unavailable for Demo Startups"),
      "Must render demo disabled text"
    );
    assert(
      cardContent.includes("disabled"),
      "CTA must have disabled attribute for demo"
    );
  });

  it("TEST 15: Demo startup does not initiate purchase (early return guard)", () => {
    const handlePurchaseFunc = cardContent.match(/const handleStartPurchase[\s\S]*?\{([\s\S]*?)\};/);
    assert(handlePurchaseFunc, "Must find handleStartPurchase function");
    assert(
      handlePurchaseFunc[1].includes("if (isDemo") || handlePurchaseFunc[1].includes("if (isDemo ||"),
      "Must guard with if (isDemo) early return"
    );
  });

  it("TEST 16: Accessibility attributes exist for busy/disabled/live states", () => {
    assert(
      cardContent.includes('aria-live="polite"'),
      "Must include aria-live on container"
    );
    assert(
      cardContent.includes("aria-busy={isBusy}"),
      "Must include aria-busy on button"
    );
    assert(
      cardContent.includes("aria-disabled"),
      "Must include aria-disabled attributes"
    );
  });

  it("TEST 17: Component does not contain direct Razorpay API calls", () => {
    assert(
      !cardContent.includes("new (window as any).Razorpay") &&
      !cardContent.includes("new window.Razorpay"),
      "Component must delegate Razorpay checkout to the hook"
    );
  });

  it("TEST 18: Component does not contain Supabase Storage calls", () => {
    assert(
      !cardContent.includes(".storage.from"),
      "Component must NOT directly query Supabase Storage"
    );
    assert(
      !cardContent.includes("supabaseServer"),
      "Component must NOT import server client"
    );
  });

  it("TEST 19: Component does not calculate payment amount", () => {
    assert(
      !cardContent.includes("REPORT_AMOUNT_PAISE") &&
      !cardContent.includes("499 * 100") &&
      !cardContent.includes("amount: 49900"),
      "Component must NOT calculate or hardcode amount into payment calls"
    );
  });

  it("TEST 20: Component does not expose secrets or server environment variables", () => {
    assert(
      !cardContent.includes("RAZORPAY_KEY_SECRET") &&
      !cardContent.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      !cardContent.includes("key_secret"),
      "Component must NOT contain any server secrets"
    );
  });
});
