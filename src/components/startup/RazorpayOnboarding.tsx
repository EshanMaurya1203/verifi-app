"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Settings,
  LayoutDashboard,
  ClipboardPaste,
  AlertTriangle,
  Lock,
  CreditCard,
  Wallet,
  Settings2,
  Info,
  CheckCircle2,
} from "lucide-react";

/* ─────────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────────── */
interface RazorpayOnboardingProps {
  rzpKeyId: string;
  rzpKeySecret: string;
  onKeyIdChange: (v: string) => void;
  onKeySecretChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  errorMsg: string | null;
}

type OnboardingStep = 1 | 2 | 3 | 4;

/* ─────────────────────────────────────────────────────
 * Constants
 * ───────────────────────────────────────────────────── */
const RAZORPAY_BLUE = "#2D81F7";
const RAZORPAY_BLUE_DIM = "rgba(45, 129, 247, 0.08)";
const RAZORPAY_BLUE_BORDER = "rgba(45, 129, 247, 0.25)";

const GUIDED_STEPS = [
  {
    step: 1 as OnboardingStep,
    icon: LayoutDashboard,
    title: "Open Razorpay Dashboard",
    description: "Log in to your Razorpay dashboard with your registered account.",
    action: "Go to Dashboard",
    link: "https://dashboard.razorpay.com",
  },
  {
    step: 2 as OnboardingStep,
    icon: Settings,
    title: "Navigate to API Keys",
    description: "In the left sidebar, go to Account & Settings → API Keys.",
    action: "Settings → API Keys",
    link: "https://dashboard.razorpay.com/app/website-app-settings/api-keys",
  },
  {
    step: 3 as OnboardingStep,
    icon: KeyRound,
    title: "Generate API Key",
    description: "Click \"Generate Key\" to create a new key pair. Copy both Key ID and Key Secret immediately — the secret is shown only once.",
    action: null,
    link: null,
  },
  {
    step: 4 as OnboardingStep,
    icon: ClipboardPaste,
    title: "Paste Credentials",
    description: "Paste your Key ID and Key Secret in the fields below to complete verification.",
    action: null,
    link: null,
  },
];

const TRUST_ITEMS = [
  { icon: Eye, text: "Read-only verification", detail: "We only read payment data" },
  { icon: CreditCard, text: "Cannot create payments", detail: "No charges will be made" },
  { icon: Wallet, text: "Cannot withdraw money", detail: "No payouts or transfers" },
  { icon: Settings2, text: "Cannot modify account settings", detail: "Your settings stay untouched" },
];

/* ─────────────────────────────────────────────────────
 * Validation helpers
 * ───────────────────────────────────────────────────── */
type ValidationState = "idle" | "valid" | "invalid" | "warning";

function validateKeyId(value: string): { state: ValidationState; message: string } {
  if (!value) return { state: "idle", message: "" };
  if (value.startsWith("rzp_test_")) return { state: "warning", message: "This is a test key — use rzp_live_ for production verification" };
  if (!value.startsWith("rzp_live_")) return { state: "invalid", message: "Key ID should start with rzp_live_ or rzp_test_" };
  if (value.length < 18) return { state: "invalid", message: "Key ID appears too short" };
  return { state: "valid", message: "Valid Razorpay Key ID format" };
}

function validateKeySecret(value: string): { state: ValidationState; message: string } {
  if (!value) return { state: "idle", message: "" };
  if (value.length < 10) return { state: "invalid", message: "Key Secret appears too short" };
  if (value.length >= 10) return { state: "valid", message: "Key Secret format looks good" };
  return { state: "idle", message: "" };
}

function getValidationColor(state: ValidationState): string {
  switch (state) {
    case "valid": return "text-emerald-400";
    case "invalid": return "text-red-400";
    case "warning": return "text-amber-400";
    default: return "text-neutral-500";
  }
}

function getValidationBorder(state: ValidationState): string {
  switch (state) {
    case "valid": return "border-emerald-500/40 focus:border-emerald-500";
    case "invalid": return "border-red-500/40 focus:border-red-500";
    case "warning": return "border-amber-500/40 focus:border-amber-500";
    default: return "border-white/10 focus:border-[#2D81F7]";
  }
}

/* ─────────────────────────────────────────────────────
 * Copy button sub-component
 * ───────────────────────────────────────────────────── */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-[10px] font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition-all duration-200 group"
      title={`Copy ${label}`}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3 group-hover:text-[#2D81F7] transition-colors" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────────────
 * Main Component
 * ───────────────────────────────────────────────────── */
export const RazorpayOnboarding: React.FC<RazorpayOnboardingProps> = ({
  rzpKeyId,
  rzpKeySecret,
  onKeyIdChange,
  onKeySecretChange,
  onSubmit,
  onBack,
  errorMsg,
}) => {
  const [activeStep, setActiveStep] = useState<OnboardingStep>(1);
  const [showSecret, setShowSecret] = useState(false);
  const [trustExpanded, setTrustExpanded] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const keyIdValidation = validateKeyId(rzpKeyId);
  const keySecretValidation = validateKeySecret(rzpKeySecret);
  const isFormValid = keyIdValidation.state === "valid" && (keySecretValidation.state === "valid" || keySecretValidation.state === "warning");
  const canProceedToStep4 = activeStep >= 3;

  // Auto-advance to step 4 when user starts typing credentials
  useEffect(() => {
    if ((rzpKeyId || rzpKeySecret) && activeStep < 4) {
      setActiveStep(4);
    }
  }, [rzpKeyId, rzpKeySecret, activeStep]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-white transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: RAZORPAY_BLUE_DIM, border: `1px solid ${RAZORPAY_BLUE_BORDER}` }}
          >
            <KeyRound className="w-3.5 h-3.5" style={{ color: RAZORPAY_BLUE }} />
          </div>
          <span className="text-sm font-bold text-white">Razorpay Verification</span>
        </div>
      </div>

      {/* ── Error Message ──────────────────────────── */}
      {errorMsg && (
        <div className="p-4 bg-red-500/8 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-red-400 font-bold uppercase tracking-wide leading-relaxed">{errorMsg}</p>
            <p className="text-[10px] text-red-400/60 mt-1">Check that your Key ID and Key Secret are correct and try again.</p>
          </div>
        </div>
      )}

      {/* ── Guided Steps ───────────────────────────── */}
      <div className="rounded-2xl border border-white/5 bg-neutral-900/40 overflow-hidden">
        <div
          className="px-5 py-3 border-b border-white/5 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${RAZORPAY_BLUE_DIM}, transparent)` }}
        >
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
            Setup Guide
          </span>
          <span className="text-[10px] font-bold text-neutral-500">
            Step {activeStep} of 4
          </span>
        </div>

        <div className="divide-y divide-white/5">
          {GUIDED_STEPS.map((step) => {
            const isActive = activeStep === step.step;
            const isCompleted = activeStep > step.step;
            const Icon = step.icon;

            return (
              <button
                key={step.step}
                type="button"
                onClick={() => setActiveStep(step.step)}
                className={`
                  w-full px-5 py-4 flex items-start gap-4 text-left transition-all duration-300 group
                  ${isActive ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"}
                `}
              >
                {/* Step indicator */}
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-300 mt-0.5
                  ${isCompleted
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                    : isActive
                      ? "border-[#2D81F7] text-[#2D81F7] shadow-[0_0_12px_rgba(45,129,247,0.2)]"
                      : "border-white/10 text-neutral-600"
                  }
                `}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-bold transition-colors duration-200 ${isActive || isCompleted ? "text-white" : "text-neutral-500"}`}>
                      {step.title}
                    </span>
                    {isCompleted && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                        Done
                      </span>
                    )}
                  </div>

                  {/* Expanded content for active step */}
                  <div className={`overflow-hidden transition-all duration-300 ${isActive ? "max-h-40 opacity-100 mt-1.5" : "max-h-0 opacity-0"}`}>
                    <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                      {step.description}
                    </p>

                    {step.link && (
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={step.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 hover:scale-[1.02]"
                          style={{
                            background: RAZORPAY_BLUE_DIM,
                            border: `1px solid ${RAZORPAY_BLUE_BORDER}`,
                            color: RAZORPAY_BLUE,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {step.action}
                        </a>
                        <CopyButton text={step.link} label="Copy link" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Chevron */}
                <ArrowRight className={`w-4 h-4 shrink-0 mt-1 transition-all duration-200 ${isActive ? "text-[#2D81F7] rotate-90" : "text-neutral-700 group-hover:text-neutral-500"}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Credentials Form ───────────────────────── */}
      <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
        <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-5 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-4 h-4" style={{ color: RAZORPAY_BLUE }} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
              API Credentials
            </span>
          </div>

          {/* Key ID Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="rzp-key-id" className="text-[11px] font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2D81F7]" />
                Razorpay Key ID
                <span className="text-red-400">*</span>
              </label>
              {keyIdValidation.state !== "idle" && (
                <span className={`text-[10px] font-bold ${getValidationColor(keyIdValidation.state)} flex items-center gap-1 animate-in fade-in duration-200`}>
                  {keyIdValidation.state === "valid" && <CheckCircle2 className="w-3 h-3" />}
                  {keyIdValidation.state === "invalid" && <AlertTriangle className="w-3 h-3" />}
                  {keyIdValidation.state === "warning" && <Info className="w-3 h-3" />}
                  {keyIdValidation.message}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="rzp-key-id"
                required
                type="text"
                placeholder="rzp_live_xxxxxxxxxxxxxxxx"
                value={rzpKeyId}
                onChange={(e) => onKeyIdChange(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className={`
                  w-full bg-black/60 border ${getValidationBorder(keyIdValidation.state)}
                  p-4 pl-11 rounded-xl outline-none font-mono text-sm text-white
                  placeholder:text-neutral-600 transition-all duration-200
                `}
              />
              <LayoutDashboard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
            </div>
            <p className="text-[10px] text-neutral-600 leading-relaxed pl-1">
              Found in Razorpay Dashboard → Account & Settings → API Keys
            </p>
          </div>

          {/* Key Secret Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label htmlFor="rzp-key-secret" className="text-[11px] font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2D81F7]" />
                Razorpay Key Secret
                <span className="text-red-400">*</span>
              </label>
              {keySecretValidation.state !== "idle" && (
                <span className={`text-[10px] font-bold ${getValidationColor(keySecretValidation.state)} flex items-center gap-1 animate-in fade-in duration-200`}>
                  {keySecretValidation.state === "valid" && <CheckCircle2 className="w-3 h-3" />}
                  {keySecretValidation.state === "invalid" && <AlertTriangle className="w-3 h-3" />}
                  {keySecretValidation.message}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="rzp-key-secret"
                required
                type={showSecret ? "text" : "password"}
                placeholder="Enter your Key Secret"
                value={rzpKeySecret}
                onChange={(e) => onKeySecretChange(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className={`
                  w-full bg-black/60 border ${getValidationBorder(keySecretValidation.state)}
                  p-4 pl-11 pr-12 rounded-xl outline-none font-mono text-sm text-white
                  placeholder:text-neutral-600 transition-all duration-200
                `}
              />
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                title={showSecret ? "Hide secret" : "Show secret"}
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-neutral-600 leading-relaxed pl-1">
              The Key Secret is only shown once when generated. If lost, generate a new key pair.
            </p>
          </div>
        </div>

        {/* ── Trust Messaging ──────────────────────── */}
        <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03] overflow-hidden">
          <button
            type="button"
            onClick={() => setTrustExpanded(!trustExpanded)}
            className="w-full px-5 py-3.5 flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-xs font-bold text-emerald-400/90">Your account is safe — read-only access only</span>
            </div>
            <ArrowRight className={`w-4 h-4 text-emerald-500/40 transition-transform duration-200 ${trustExpanded ? "rotate-90" : ""}`} />
          </button>

          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${trustExpanded ? "max-h-80" : "max-h-0"}`}>
            <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TRUST_ITEMS.map((item, idx) => {
                const ItemIcon = item.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/10"
                  >
                    <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <ItemIcon className="w-3 h-3 text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-emerald-300 block">{item.text}</span>
                      <span className="text-[10px] text-emerald-500/60">{item.detail}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 pb-4">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-neutral-500 leading-relaxed">
                  Keys are encrypted at rest using AES-256-GCM and used exclusively for read-only revenue aggregation.
                  We never store raw transaction details — only aggregated metrics.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Submit Button ────────────────────────── */}
        <button
          type="submit"
          disabled={!rzpKeyId || !rzpKeySecret}
          className={`
            w-full py-4 rounded-xl font-black uppercase tracking-[0.15em] text-[11px]
            flex items-center justify-center gap-2 transition-all duration-300
            ${rzpKeyId && rzpKeySecret
              ? isFormValid
                ? "bg-white text-black hover:bg-neutral-200 hover:scale-[1.01] shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                : "bg-white/80 text-black/80 hover:bg-white"
              : "bg-white/10 text-neutral-500 cursor-not-allowed"
            }
          `}
        >
          {isFormValid && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          Start Verification Process
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* ── Validation Summary ───────────────────── */}
        {(rzpKeyId || rzpKeySecret) && !isFormValid && (
          <div className="text-center animate-in fade-in duration-200">
            <p className="text-[10px] text-neutral-500">
              {!rzpKeyId && !rzpKeySecret
                ? "Enter your API credentials above"
                : keyIdValidation.state === "invalid"
                  ? "Fix the Key ID format to continue"
                  : keySecretValidation.state === "invalid"
                    ? "Fix the Key Secret to continue"
                    : "Complete both fields to continue"
              }
            </p>
          </div>
        )}
      </form>
    </div>
  );
};
