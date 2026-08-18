"use client";

import React from "react";
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  RefreshCw,
  Sparkles,
  Layers,
  BarChart3,
  Lock,
} from "lucide-react";
import { useInvestorReport } from "@/lib/reports/use-investor-report";

export interface InvestorReportCardProps {
  startupId: number;
  startupName: string;
  isDemo?: boolean;
  userEmail?: string;
  userName?: string;
}

/**
 * InvestorReportCard
 *
 * Production-quality UI component for purchasing and downloading
 * the Verifii Verified Investor Report (₹499 One-Time Add-On).
 *
 * Consumes the useInvestorReport client runner hook.
 * The card is purely a presentation and interaction layer.
 */
export function InvestorReportCard({
  startupId,
  startupName,
  isDemo = false,
  userEmail,
  userName,
}: InvestorReportCardProps) {
  const {
    state,
    downloadUrl,
    error,
    startPurchase,
    retryGeneration,
    reset,
  } = useInvestorReport();

  const handleStartPurchase = async () => {
    if (isDemo || state === "creating_order" || state === "payment_open" || state === "verifying") {
      return;
    }
    await startPurchase(startupId, {
      name: userName,
      email: userEmail,
    });
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    }
  };

  const isBusy = state === "creating_order" || state === "payment_open" || state === "verifying";

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm transition-all font-sans"
      aria-live="polite"
    >
      {/* Background Glow Accent */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-primary uppercase border border-primary/20">
                <Sparkles className="h-3 w-3" />
                Add-On
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                One-Time Purchase
              </span>
            </div>
            <h3 className="font-syne text-2xl font-bold tracking-tight text-foreground">
              Investor Report
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Independent revenue verification report for {startupName || "your startup"}
            </p>
          </div>
        </div>

        {/* Pricing Badge */}
        <div className="flex flex-col sm:items-end bg-muted/40 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-border">
          <div className="flex items-baseline gap-1">
            <span className="font-syne text-3xl font-extrabold text-foreground">
              ₹499
            </span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              One-Time
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5">
            No subscription required
          </span>
        </div>
      </div>

      {/* Feature Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="flex items-start gap-2.5 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
          <BarChart3 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <div>
            <p className="text-xs font-bold text-foreground">30-Day Verified Revenue</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Provider-backed direct metrics snapshot
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
          <Layers className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <div>
            <p className="text-xs font-bold text-foreground">Gateway Breakdown</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Stripe & Razorpay source data
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl border border-border/60 bg-muted/20 p-3.5">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <div>
            <p className="text-xs font-bold text-foreground">Verifii Trust Score</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Tamper-resistant cryptographic PDF
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic State Feedback Section */}

      {/* 1. CREATING ORDER STATE */}
      {state === "creating_order" && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
          <div>
            <p className="text-sm font-bold text-foreground">
              Preparing Secure Checkout...
            </p>
            <p className="text-xs text-muted-foreground">
              Initializing payment order with Razorpay.
            </p>
          </div>
        </div>
      )}

      {/* 2. PAYMENT OPEN STATE */}
      {state === "payment_open" && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
          <div>
            <p className="text-sm font-bold text-foreground">
              Checkout Active
            </p>
            <p className="text-xs text-muted-foreground">
              Complete your payment in the Razorpay window to generate the report.
            </p>
          </div>
        </div>
      )}

      {/* 3. VERIFYING STATE */}
      {state === "verifying" && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
          <div>
            <p className="text-sm font-bold text-foreground">
              Payment received. Verifying your payment...
            </p>
            <p className="text-xs text-muted-foreground">
              Cryptographically verifying transaction signature with server gateway.
            </p>
          </div>
        </div>
      )}

      {/* 4. GENERATING STATE */}
      {state === "generating" && (
        <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-foreground">
                  Payment verified. Your Investor Report is being generated.
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Freezing revenue snapshot and compiling high-resolution vector PDF.
                </p>
              </div>
            </div>
            <button
              onClick={retryGeneration}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted transition-colors shrink-0"
              title="Check generation status"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Check Status
            </button>
          </div>
        </div>
      )}

      {/* 5. COMPLETED STATE */}
      {state === "completed" && downloadUrl && (
        <div className="mb-6 rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-foreground">
                  Investor Report Ready
                </p>
                <p className="text-xs text-muted-foreground">
                  Secure signed download URL generated (valid for 60 seconds).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-[#a8e630] transition-colors shadow-sm"
              >
                <Download className="h-4 w-4" />
                Download Investor Report
              </button>
              <button
                onClick={reset}
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Reset card"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ERROR STATE */}
      {state === "error" && error && (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-500">
                  Unable to complete request
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={reset}
              className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted transition-colors shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-border/60">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 text-primary" />
          <span>Server-verified data • Private encrypted storage</span>
        </div>

        {/* Primary CTA (Rendered when idle or error) */}
        {state !== "completed" && (
          <div>
            {isDemo ? (
              <button
                disabled
                aria-disabled="true"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-muted px-6 py-3 text-sm font-bold text-muted-foreground cursor-not-allowed border border-border"
              >
                Unavailable for Demo Startups
              </button>
            ) : (
              <button
                onClick={handleStartPurchase}
                disabled={isBusy}
                aria-busy={isBusy}
                aria-disabled={isBusy}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition-all shadow-sm ${
                  isBusy
                    ? "bg-primary/50 text-primary-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-[#a8e630] hover:-translate-y-0.5 hover:shadow-md"
                }`}
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    <span>Generate Investor Report — ₹499</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
