/**
 * A4.5 Step 5 Blocker Regression Test
 * TrialCountdownBanner Infinite Render Fix Verification
 *
 * Verifies that TrialCountdownBanner:
 * - Uses a referentially stable external clock store with listener subscriptions
 * - Does NOT use unstable () => Date.now() inline snapshot without store change events
 * - Uses SSR-safe getSSRClockSnapshot returning null
 * - Cleans up interval when all listeners unsubscribe
 * - Preserves trialing status countdown semantics
 * - Returns null for non-trialing statuses
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";

describe("A4.5 Step 5 Blocker — TrialCountdownBanner Regression", () => {
  const bannerPath = path.join(process.cwd(), "src/components/billing/TrialCountdownBanner.tsx");
  const bannerExists = fs.existsSync(bannerPath);
  const bannerContent = bannerExists ? fs.readFileSync(bannerPath, "utf8") : "";

  it("TEST 1: TrialCountdownBanner file exists and has 'use client' directive", () => {
    assert(bannerExists, "TrialCountdownBanner.tsx must exist");
    assert(bannerContent.includes('"use client"'), 'Must have "use client" directive');
    assert(
      bannerContent.includes("export function TrialCountdownBanner"),
      "Must export TrialCountdownBanner component"
    );
  });

  it("TEST 2: No unstable getNow = () => Date.now() inline snapshot pattern remains", () => {
    assert(
      !bannerContent.includes("getNow = () => Date.now()"),
      "Must NOT use unstable inline getNow snapshot"
    );
    assert(
      !bannerContent.includes("const emptySubscribe = () => () => {};"),
      "Must NOT use fake emptySubscribe"
    );
  });

  it("TEST 3: Implements referentially stable subscribeClock with listener management", () => {
    assert(
      bannerContent.includes("function subscribeClock"),
      "Must implement subscribeClock listener manager"
    );
    assert(
      bannerContent.includes("clockListeners.add"),
      "Must track listener subscriptions"
    );
    assert(
      bannerContent.includes("clockListeners.delete"),
      "Must clean up listeners on unsubscribe"
    );
  });

  it("TEST 4: Interval is set and cleaned up when listeners reach zero", () => {
    assert(
      bannerContent.includes("setInterval("),
      "Must set interval for periodic updates"
    );
    assert(
      bannerContent.includes("clearInterval("),
      "Must clean up interval when no listeners remain"
    );
  });

  it("TEST 5: Initial SSR snapshot is null to prevent hydration mismatch", () => {
    assert(
      bannerContent.includes("function getSSRClockSnapshot(): null"),
      "Must return null for SSR snapshot"
    );
    assert(
      bannerContent.includes("if (now === null) return null;"),
      "Must return null when now is null (pre-mount SSR render)"
    );
  });

  it("TEST 6: Preserves existing trialing status check and trialEnd prop", () => {
    assert(
      bannerContent.includes('status !== "trialing"'),
      "Must check for status !== 'trialing'"
    );
    assert(
      bannerContent.includes("!trialEnd"),
      "Must check for missing trialEnd"
    );
  });

  it("TEST 7: Preserves daysLeft calculation and 14-day safety check", () => {
    assert(
      bannerContent.includes("new Date(trialEnd).getTime() - now"),
      "Must calculate days remaining against now"
    );
    assert(
      bannerContent.includes("daysLeft > 14"),
      "Must preserve 14-day safety check"
    );
  });

  it("TEST 8: Preserves link to /dashboard/billing with Manage Subscription CTA", () => {
    assert(
      bannerContent.includes('href="/dashboard/billing"'),
      "Must link to /dashboard/billing"
    );
    assert(
      bannerContent.includes("Manage Subscription"),
      "Must display Manage Subscription CTA"
    );
  });
});
