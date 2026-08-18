import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase-server";
import { timingSafeCompare } from "@/lib/encryption";
import { getAggregatedRevenue } from "@/lib/revenue-aggregation";
import { computeTrustScore } from "@/lib/scoring";
import {
  generateInvestorReportPdf,
  InvestorReportInput,
} from "@/lib/reports/investor-report-generator";
import Razorpay from "razorpay";
import crypto from "crypto";

/**
 * Commercial Model: Investor Report ₹499 One-Time Purchase Verification
 * 
 * Concurrency & Lifecycle Architecture:
 * - F-3C-02: Atomic database claim (`payment_status = 'pending' -> 'paid' + 'generating'`).
 *   Guarantees that exactly ONE concurrent request acquires ownership of PDF generation and storage upload.
 * - F-3C-01: Crash-safe stale generation reclamation (`updated_at <= now() - 2 minutes` with null `storage_path`).
 *   Guarantees that abandoned generations after process crashes are atomically reclaimed without creating duplicate PDFs.
 * - Immutability: Reuses frozen `metrics_snapshot` on retries; never recalculates live revenue on retry.
 * - Storage: Private bucket `investor-reports` at `<user_id>/<report_id>.pdf` with 60-second signed URL.
 */
const EXPECTED_AMOUNT_PAISE = 49900;
const EXPECTED_CURRENCY = "INR";
const STORAGE_BUCKET = "investor-reports";
const SIGNED_URL_EXPIRY_SECONDS = 60;
const STALE_GENERATION_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes conservative stale threshold

interface VerifyPaymentRequestBody {
  report_id?: unknown;
  order_id?: unknown;
  payment_id?: unknown;
  signature?: unknown;
}

interface RazorpayPaymentResponse {
  id: string;
  order_id?: string;
  amount: number;
  currency: string;
  status: string;
}

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting (Brute-force protection)
    const identifier = getClientIdentifier(req);
    const { allowed } = await checkRateLimit(identifier, 60000, 10);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // 2. Authentication
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // 3. Payload Validation
    let body: VerifyPaymentRequestBody;
    try {
      body = (await req.json()) as VerifyPaymentRequestBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { report_id, order_id, payment_id, signature } = body;

    if (
      !report_id ||
      typeof report_id !== "string" ||
      !order_id ||
      typeof order_id !== "string" ||
      !payment_id ||
      typeof payment_id !== "string" ||
      !signature ||
      typeof signature !== "string"
    ) {
      return NextResponse.json(
        { error: "Missing required verification parameters (report_id, order_id, payment_id, signature)" },
        { status: 400 }
      );
    }

    // 4. Load Database Record & Verify Ownership (Strict IDOR Defense)
    const { data: report, error: reportError } = await supabaseServer
      .from("investor_reports")
      .select("*")
      .eq("id", report_id)
      .maybeSingle();

    if (reportError || !report) {
      return NextResponse.json({ error: "Investor report record not found" }, { status: 404 });
    }

    if (report.user_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: You do not own this report" },
        { status: 403 }
      );
    }

    if (report.razorpay_order_id !== order_id) {
      return NextResponse.json(
        { error: "Supplied order ID does not match report record" },
        { status: 400 }
      );
    }

    if (report.payment_status === "refunded") {
      return NextResponse.json(
        { error: "Report payment was refunded. Fulfillment disabled." },
        { status: 400 }
      );
    }

    // 5. Idempotent Fast-Path: If already completed, generate fresh signed URL without re-rendering
    if (report.payment_status === "paid" && report.generation_status === "completed" && report.storage_path) {
      const { data: signedUrlData, error: signErr } = await supabaseServer
        .storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(report.storage_path, SIGNED_URL_EXPIRY_SECONDS);

      if (!signErr && signedUrlData?.signedUrl) {
        return NextResponse.json({
          success: true,
          report_id: report.id,
          status: "completed",
          download_url: signedUrlData.signedUrl,
        });
      }
    }

    // 6. Concurrency Guard & Stale Crash-Recovery (F-3C-01)
    let isGenerationOwner = false;

    if (report.payment_status === "paid") {
      if (report.generation_status === "generating") {
        const updatedAtMs = new Date(report.updated_at || report.created_at).getTime();
        const isStale = Date.now() - updatedAtMs > STALE_GENERATION_THRESHOLD_MS;

        if (!isStale) {
          // Active generation is recent: return in-progress without stealing claim
          return NextResponse.json({
            success: true,
            report_id: report.id,
            status: "generating",
            message: "Report generation in progress. Please retry shortly.",
          });
        }

        // Stale generation (> 2 minutes with null storage_path): Attempt atomic database reclamation
        const staleCutoff = new Date(Date.now() - STALE_GENERATION_THRESHOLD_MS).toISOString();
        const { data: reclaimedReport, error: reclaimErr } = await supabaseServer
          .from("investor_reports")
          .update({
            generation_status: "generating",
            updated_at: new Date().toISOString(),
          })
          .eq("id", report.id)
          .eq("payment_status", "paid")
          .eq("generation_status", "generating")
          .is("storage_path", null)
          .lte("updated_at", staleCutoff)
          .select("*")
          .maybeSingle();

        if (reclaimErr || !reclaimedReport) {
          // Another concurrent request won reclamation or state transitioned
          console.warn("[Investor Report Verify] Lost race for stale generation reclamation:", report.id);
          const { data: currentReport } = await supabaseServer
            .from("investor_reports")
            .select("*")
            .eq("id", report.id)
            .maybeSingle();

          if (currentReport?.generation_status === "completed" && currentReport?.storage_path) {
            const { data: signedUrlData } = await supabaseServer
              .storage
              .from(STORAGE_BUCKET)
              .createSignedUrl(currentReport.storage_path, SIGNED_URL_EXPIRY_SECONDS);

            return NextResponse.json({
              success: true,
              report_id: currentReport.id,
              status: "completed",
              download_url: signedUrlData?.signedUrl,
            });
          }

          return NextResponse.json({
            success: true,
            report_id: report.id,
            status: "generating",
            message: "Report generation in progress. Please retry shortly.",
          });
        }

        console.info(`[Investor Report Verify INFO] Atomically reclaimed stale generation for report: ${report.id}`);
        isGenerationOwner = true;
      } else if (report.generation_status === "failed") {
        // Generation failed previously: Attempt atomic retry claim
        const { data: retryClaimedReport } = await supabaseServer
          .from("investor_reports")
          .update({
            generation_status: "generating",
            updated_at: new Date().toISOString(),
          })
          .eq("id", report.id)
          .eq("payment_status", "paid")
          .eq("generation_status", "failed")
          .select("*")
          .maybeSingle();

        if (!retryClaimedReport) {
          return NextResponse.json({
            success: true,
            report_id: report.id,
            status: "generating",
            message: "Report generation in progress. Please retry shortly.",
          });
        }

        isGenerationOwner = true;
      }
    }

    // 7. Signature & Provider Verification with Atomic Database Claim (F-3C-02)
    if (report.payment_status === "pending") {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!keyId || !keySecret) {
        console.error("[Investor Report Verify] Missing Razorpay credentials");
        return NextResponse.json(
          { error: "Razorpay billing credentials are not configured" },
          { status: 500 }
        );
      }

      // 7a. Timing-Safe HMAC-SHA256 Signature Verification
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${order_id}|${payment_id}`)
        .digest("hex");

      if (!timingSafeCompare(expectedSignature, signature)) {
        console.warn("[Investor Report Verify] Invalid HMAC signature for report:", report_id);
        return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
      }

      // 7b. Independent Razorpay Provider Verification
      const razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      let rzpPayment: RazorpayPaymentResponse;
      let rzpOrder: RazorpayOrderResponse;

      try {
        const [fetchedPayment, fetchedOrder] = await Promise.all([
          razorpay.payments.fetch(payment_id),
          razorpay.orders.fetch(order_id),
        ]);
        rzpPayment = fetchedPayment as unknown as RazorpayPaymentResponse;
        rzpOrder = fetchedOrder as unknown as RazorpayOrderResponse;
      } catch (fetchErr: unknown) {
        const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        console.error("[Investor Report Verify] Gateway verification error:", errMsg);
        return NextResponse.json(
          { error: "Failed to verify payment with payment gateway" },
          { status: 502 }
        );
      }

      // 7c. Strict Payment Invariant Checks
      const isPaymentIdMatch = rzpPayment?.id === payment_id;
      const isPaymentOrderMatch = rzpPayment?.order_id === order_id;
      const isOrderMatch = rzpOrder?.id === report.razorpay_order_id;
      const isPaymentAmountValid = rzpPayment?.amount === EXPECTED_AMOUNT_PAISE;
      const isPaymentCurrencyValid = rzpPayment?.currency === EXPECTED_CURRENCY;
      const isOrderAmountValid = rzpOrder?.amount === EXPECTED_AMOUNT_PAISE;
      const isOrderCurrencyValid = rzpOrder?.currency === EXPECTED_CURRENCY;
      const isCaptured = rzpPayment?.status === "captured";

      if (
        !isPaymentIdMatch ||
        !isPaymentOrderMatch ||
        !isOrderMatch ||
        !isPaymentAmountValid ||
        !isPaymentCurrencyValid ||
        !isOrderAmountValid ||
        !isOrderCurrencyValid ||
        !isCaptured
      ) {
        console.warn("[Investor Report Verify] Payment invariants violation:", {
          isPaymentIdMatch,
          isPaymentOrderMatch,
          isOrderMatch,
          isPaymentAmountValid,
          isPaymentCurrencyValid,
          isOrderAmountValid,
          isOrderCurrencyValid,
          status: rzpPayment?.status,
        });

        return NextResponse.json(
          { error: "Payment verification failed: Payment not captured or parameters mismatched" },
          { status: 400 }
        );
      }

      // 7d. Atomic Database Claim: pending -> paid + generating (F-3C-02)
      const { data: claimedReport, error: claimErr } = await supabaseServer
        .from("investor_reports")
        .update({
          payment_status: "paid",
          razorpay_payment_id: payment_id,
          paid_at: new Date().toISOString(),
          generation_status: "generating",
          updated_at: new Date().toISOString(),
        })
        .eq("id", report.id)
        .eq("payment_status", "pending")
        .select("*")
        .maybeSingle();

      if (claimErr) {
        console.error("[Investor Report Verify CRITICAL] Database error during atomic claim:", claimErr);
        return NextResponse.json(
          { error: "Failed to update payment status in database" },
          { status: 500 }
        );
      }

      if (!claimedReport) {
        // Concurrent request already won the claim
        console.info(`[Investor Report Verify INFO] Concurrent request already claimed generation for report: ${report.id}`);
        const { data: updatedCurrentReport } = await supabaseServer
          .from("investor_reports")
          .select("*")
          .eq("id", report.id)
          .maybeSingle();

        if (updatedCurrentReport?.generation_status === "completed" && updatedCurrentReport?.storage_path) {
          const { data: signedUrlData } = await supabaseServer
            .storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(updatedCurrentReport.storage_path, SIGNED_URL_EXPIRY_SECONDS);

          return NextResponse.json({
            success: true,
            report_id: updatedCurrentReport.id,
            status: "completed",
            download_url: signedUrlData?.signedUrl,
          });
        }

        return NextResponse.json({
          success: true,
          report_id: report.id,
          status: "generating",
          message: "Report generation in progress. Please retry shortly.",
        });
      }

      isGenerationOwner = true;
    }

    if (!isGenerationOwner) {
      return NextResponse.json({
        success: true,
        report_id: report.id,
        status: "generating",
        message: "Report generation in progress. Please retry shortly.",
      });
    }

    // 8. Immutable Metrics Snapshot Compilation
    // If snapshot already exists (e.g. retry/reclamation), reuse it directly without recalculating live metrics
    let snapshot: InvestorReportInput;
    const existingSnapshot = report.metrics_snapshot as unknown as InvestorReportInput | undefined;

    if (existingSnapshot && existingSnapshot.startup && existingSnapshot.verifiedRevenue) {
      snapshot = existingSnapshot;
    } else {
      // Load authoritative startup record
      const { data: startup } = await supabaseServer
        .from("startup_submissions")
        .select("*")
        .eq("id", report.startup_id)
        .single();

      if (!startup) {
        // Mark generation failed (payment remains paid)
        await supabaseServer
          .from("investor_reports")
          .update({ generation_status: "failed", updated_at: new Date().toISOString() })
          .eq("id", report.id);

        return NextResponse.json({ error: "Associated startup record not found" }, { status: 500 });
      }

      // Fetch canonical aggregated revenue & canonical trust score
      const revenueData = await getAggregatedRevenue(Number(report.startup_id));
      const trustData = await computeTrustScore(Number(report.startup_id), { startup, persist: false });

      const transactionCount = revenueData.providers.reduce(
        (sum, p) => sum + (p.transactionCount || 0),
        0
      );
      const connectedCount = revenueData.providers.filter((p) => p.success).length;

      snapshot = {
        reportId: report.id,
        reportPeriod: "30_days",
        generatedAt: new Date().toISOString(),
        startup: {
          name: startup.startup_name || "Untitled Startup",
          slug: startup.slug || `startup-${report.startup_id}`,
          category: startup.category || "General Technology",
          websiteUrl: startup.website || undefined,
          founderName: startup.founder_name || "Verified Founder",
          founderBio: startup.bio || undefined,
          publicVerificationUrl: `https://verifii.in/startup/${startup.slug || report.startup_id}`,
        },
        verifiedRevenue: {
          totalRevenueInr: revenueData.totalRevenue || 0,
          transactionCount,
          connectedGatewaysCount: connectedCount,
          lastSynchronizedAt: new Date().toISOString(),
          providers: revenueData.providers.map((p) => ({
            provider: p.provider,
            revenueInr: p.revenue,
            originalRevenue: p.originalRevenue,
            originalCurrency: p.originalCurrency,
            transactionCount: p.transactionCount || 0,
            status: p.success ? "connected" : "failed",
          })),
        },
        trustMetrics: {
          trustScore: trustData.score || 0,
          trustTier: trustData.tier || "Verified Founder",
          consistencyRating: trustData.score >= 70 ? "HIGH (Consistent recurring volume)" : "MODERATE",
          penaltyCount: Number(startup.penalty_count) || 0,
          cleanEventsCount: Number(startup.clean_events) || 0,
        },
      };

      // Persist frozen snapshot
      await supabaseServer
        .from("investor_reports")
        .update({ metrics_snapshot: snapshot, updated_at: new Date().toISOString() })
        .eq("id", report.id);
    }

    // 9. Pure PDF Generation
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = generateInvestorReportPdf(snapshot);
    } catch (genErr: unknown) {
      console.error("[Investor Report Verify] PDF generation threw error:", genErr);
      // Generation failed, but payment remains paid
      await supabaseServer
        .from("investor_reports")
        .update({ generation_status: "failed", updated_at: new Date().toISOString() })
        .eq("id", report.id);

      return NextResponse.json(
        { error: "PDF generation failed. Payment is preserved and retryable.", status: "generation_failed" },
        { status: 500 }
      );
    }

    // 10. Upload to Private Supabase Storage Bucket (<user_id>/<report_id>.pdf)
    const storagePath = `${user.id}/${report.id}.pdf`;

    const { error: uploadError } = await supabaseServer
      .storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("[Investor Report Verify] Storage upload error:", uploadError);
      // Upload failed, but payment remains paid
      await supabaseServer
        .from("investor_reports")
        .update({ generation_status: "failed", updated_at: new Date().toISOString() })
        .eq("id", report.id);

      return NextResponse.json(
        { error: "Storage upload failed. Payment is preserved and retryable.", status: "generation_failed" },
        { status: 500 }
      );
    }

    // 11. Final Database Completion State Transition
    const { error: completeErr } = await supabaseServer
      .from("investor_reports")
      .update({
        generation_status: "completed",
        storage_path: storagePath,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", report.id);

    if (completeErr) {
      console.error("[Investor Report Verify] Completion update error:", completeErr);
    }

    // 12. Create Short-Lived Signed Download URL (60s)
    const { data: signedUrlData } = await supabaseServer
      .storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

    return NextResponse.json({
      success: true,
      report_id: report.id,
      status: "completed",
      download_url: signedUrlData?.signedUrl,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Investor Report Verify] Unhandled exception in verify-payment route:", errMsg);
    return NextResponse.json(
      { error: "Internal server error verifying report payment" },
      { status: 500 }
    );
  }
}
