/**
 * A4.5 Step 4D — Dashboard Integration Test Suite
 *
 * Tests that InvestorReportCard is cleanly integrated into src/app/dashboard/page.tsx:
 * - Server component status is preserved (no "use client" in page.tsx)
 * - primaryStartup.id and primaryStartup.startup_name are passed
 * - EmptyDashboard branch does NOT render InvestorReportCard
 * - Zero billing API / direct Razorpay / client storage leaks in page.tsx
 * - Subscription components remain isolated
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";

describe("A4.5 Step 4D — InvestorReportCard Dashboard Integration", () => {
  const dashboardPath = path.join(process.cwd(), "src/app/dashboard/page.tsx");
  const dashboardExists = fs.existsSync(dashboardPath);
  const dashboardContent = dashboardExists ? fs.readFileSync(dashboardPath, "utf8") : "";

  it("TEST 1: Dashboard page exists and remains a Server Component (no 'use client')", () => {
    assert(dashboardExists, "src/app/dashboard/page.tsx must exist");
    assert(
      !dashboardContent.includes('"use client"') && !dashboardContent.includes("'use client'"),
      "Dashboard page must remain a Server Component"
    );
    assert(
      dashboardContent.includes("export default async function DashboardPage"),
      "DashboardPage must be an async Server Component function"
    );
  });

  it("TEST 2: InvestorReportCard is imported from @/components/reports/InvestorReportCard", () => {
    assert(
      dashboardContent.includes('import { InvestorReportCard } from "@/components/reports/InvestorReportCard"'),
      "Must import InvestorReportCard from @/components/reports/InvestorReportCard"
    );
  });

  it("TEST 3: Dashboard passes primaryStartup.id to InvestorReportCard", () => {
    assert(
      dashboardContent.includes("startupId={primaryStartup.id}"),
      "Must pass startupId={primaryStartup.id} to InvestorReportCard"
    );
  });

  it("TEST 4: Dashboard passes primaryStartup.startup_name to InvestorReportCard", () => {
    assert(
      dashboardContent.includes("startupName={primaryStartup.startup_name"),
      "Must pass startupName={primaryStartup.startup_name || ...} to InvestorReportCard"
    );
  });

  it("TEST 5: InvestorReportCard is rendered ONLY when primaryStartup exists", () => {
    // Check that in the !primaryStartup branch, content = <EmptyDashboard />
    const emptyBranchMatch = dashboardContent.match(/if \(!primaryStartup\) \{([\s\S]*?)\} else \{/);
    assert(emptyBranchMatch, "Must find if (!primaryStartup) branch");
    assert(
      emptyBranchMatch[1].includes("<EmptyDashboard />") || emptyBranchMatch[1].includes("<EmptyDashboard"),
      "Must render EmptyDashboard when primaryStartup is null"
    );
    assert(
      !emptyBranchMatch[1].includes("<InvestorReportCard"),
      "Must NOT render InvestorReportCard in empty startup branch"
    );
  });

  it("TEST 6: Existing dashboard empty state remains intact", () => {
    assert(
      dashboardContent.includes("import { EmptyDashboard } from"),
      "Must import EmptyDashboard"
    );
    assert(
      dashboardContent.includes("content = <EmptyDashboard />;"),
      "Must assign EmptyDashboard when no startup exists"
    );
  });

  it("TEST 7: No billing API references are added to dashboard page", () => {
    assert(
      !dashboardContent.includes("/api/billing/checkout"),
      "Must NOT reference /api/billing/checkout in dashboard page"
    );
    assert(
      !dashboardContent.includes("/api/billing/change-plan"),
      "Must NOT reference /api/billing/change-plan in dashboard page"
    );
    assert(
      !dashboardContent.includes("/api/billing/cancel"),
      "Must NOT reference /api/billing/cancel in dashboard page"
    );
  });

  it("TEST 8: No Razorpay API or secret references are added to dashboard page", () => {
    assert(
      !dashboardContent.includes("new Razorpay") &&
      !dashboardContent.includes("new (window as any).Razorpay") &&
      !dashboardContent.includes("RAZORPAY_KEY_SECRET") &&
      !dashboardContent.includes("key_secret"),
      "Dashboard page must NOT contain direct Razorpay instantiation or secrets"
    );
  });

  it("TEST 9: No browser Supabase client is added to page.tsx", () => {
    assert(
      !dashboardContent.includes("createBrowserClient"),
      "Dashboard page must NOT import createBrowserClient"
    );
  });

  it("TEST 10: No hardcoded payment amount or calculation logic is added to dashboard page", () => {
    assert(
      !dashboardContent.includes("REPORT_AMOUNT_PAISE") &&
      !dashboardContent.includes("49900") &&
      !dashboardContent.includes("amount: 499"),
      "Dashboard page must NOT perform payment calculations"
    );
  });

  it("TEST 11: No unnecessary personal data (userEmail, userName) is passed to InvestorReportCard", () => {
    const cardRenderMatch = dashboardContent.match(/<InvestorReportCard[\s\S]*?\/>/);
    assert(cardRenderMatch, "Must find InvestorReportCard rendering in dashboard page");
    assert(
      !cardRenderMatch[0].includes("userEmail"),
      "InvestorReportCard must NOT receive userEmail prop"
    );
    assert(
      !cardRenderMatch[0].includes("userName"),
      "InvestorReportCard must NOT receive userName prop"
    );
  });
});
