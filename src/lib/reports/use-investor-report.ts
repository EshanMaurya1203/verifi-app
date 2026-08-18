"use client";

import { useState, useCallback, useRef } from "react";

/**
 * Commercial Model: Investor Report ₹499 One-Time Add-On Client Runner
 * 
 * Invariants:
 * - Server is the SOLE authority for pricing (49900 paise / INR).
 * - Client sends ONLY { startup_id } to /api/reports/create-order.
 * - Client NEVER sends amount, currency, user_id, or report_period.
 * - Razorpay standard checkout is dynamically loaded via https://checkout.razorpay.com/v1/checkout.js.
 * - Razorpay modal uses server-returned key_id, order_id, amount, and currency.
 * - Payment handler passes payment_id, order_id, signature, report_id to /api/reports/verify-payment.
 * - State machine represents: idle, creating_order, payment_open, verifying, generating, completed, error.
 * - "generating" is an in-progress state, NOT an error.
 * - Retry re-enters verification using preserved payment credentials without creating a new order or charging again.
 */

export type InvestorReportState =
  | "idle"
  | "creating_order"
  | "payment_open"
  | "verifying"
  | "generating"
  | "completed"
  | "error";

export interface CreateOrderResponse {
  success: boolean;
  report_id: string;
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  error?: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  report_id: string;
  status: "completed" | "generating" | "failed";
  download_url?: string;
  message?: string;
  error?: string;
}

export interface RazorpayPaymentSuccessPayload {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayPaymentSuccessPayload) => void;
  modal: {
    ondismiss: () => void;
  };
  prefill?: {
    name?: string;
    email?: string;
  };
  theme: {
    color: string;
  };
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

/**
 * Dynamically loads the official Razorpay Checkout script if not already present.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error("[Investor Report] Failed to load Razorpay Checkout script");
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export interface UseInvestorReportReturn {
  state: InvestorReportState;
  reportId: string | null;
  orderId: string | null;
  downloadUrl: string | null;
  error: string | null;
  startPurchase: (startupId: number, prefill?: { name?: string; email?: string }) => Promise<void>;
  retryGeneration: () => Promise<void>;
  reset: () => void;
}

export function useInvestorReport(): UseInvestorReportReturn {
  const [state, setState] = useState<InvestorReportState>("idle");
  const [reportId, setReportId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Retain verification credentials for safe retries without re-charging
  const lastPaymentCredentialsRef = useRef<{
    reportId: string;
    orderId: string;
    paymentId: string;
    signature: string;
  } | null>(null);

  const isBusyRef = useRef<boolean>(false);

  const reset = useCallback(() => {
    setState("idle");
    setReportId(null);
    setOrderId(null);
    setDownloadUrl(null);
    setError(null);
    lastPaymentCredentialsRef.current = null;
    isBusyRef.current = false;
  }, []);

  const verifyPayment = useCallback(
    async (credentials: {
      reportId: string;
      orderId: string;
      paymentId: string;
      signature: string;
    }) => {
      setState("verifying");
      setError(null);

      try {
        const res = await fetch("/api/reports/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            report_id: credentials.reportId,
            order_id: credentials.orderId,
            payment_id: credentials.paymentId,
            signature: credentials.signature,
          }),
        });

        const data = (await res.json()) as VerifyPaymentResponse;

        if (!res.ok) {
          setState("error");
          setError(data.error || "Payment verification failed. Please try again.");
          isBusyRef.current = false;
          return;
        }

        if (data.status === "completed" && data.download_url) {
          setState("completed");
          setDownloadUrl(data.download_url);
          isBusyRef.current = false;
          return;
        }

        if (data.status === "generating") {
          setState("generating");
          isBusyRef.current = false;
          return;
        }

        // Fallback for unexpected status
        setState("error");
        setError(data.error || data.message || "Unexpected verification status");
        isBusyRef.current = false;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Network error verifying payment";
        console.error("[Investor Report] Verification network exception:", errMsg);
        setState("error");
        setError(errMsg);
        isBusyRef.current = false;
      }
    },
    []
  );

  const startPurchase = useCallback(
    async (startupId: number, prefill?: { name?: string; email?: string }) => {
      // 1. Prevent duplicate concurrent invocations
      if (isBusyRef.current) {
        console.warn("[Investor Report] Purchase already in progress. Ignoring duplicate click.");
        return;
      }

      if (!startupId || typeof startupId !== "number" || startupId <= 0) {
        setState("error");
        setError("Invalid startup ID provided for report purchase.");
        return;
      }

      isBusyRef.current = true;
      setState("creating_order");
      setError(null);
      setDownloadUrl(null);

      try {
        // 2. Initialize Order on Server (Client sends ONLY { startup_id })
        const res = await fetch("/api/reports/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startup_id: startupId,
          }),
        });

        const orderData = (await res.json()) as CreateOrderResponse;

        if (!res.ok || !orderData.success || !orderData.order_id || !orderData.key_id) {
          setState("error");
          setError(orderData.error || "Failed to initialize payment order with server.");
          isBusyRef.current = false;
          return;
        }

        setReportId(orderData.report_id);
        setOrderId(orderData.order_id);

        // 3. Load Razorpay Checkout Script
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded || !window.Razorpay) {
          setState("error");
          setError("Failed to load payment gateway checkout component. Please check your internet connection.");
          isBusyRef.current = false;
          return;
        }

        // 4. Instantiate Razorpay Standard Checkout
        setState("payment_open");

        const options: RazorpayOptions = {
          key: orderData.key_id,
          amount: orderData.amount, // Consumed from server response (never hardcoded)
          currency: orderData.currency, // Consumed from server response
          name: "Verifii",
          description: "Investor Verification Report (30-Day Snapshot)",
          order_id: orderData.order_id,
          handler: async (response: RazorpayPaymentSuccessPayload) => {
            // Forward verified credentials to server verification endpoint
            const credentials = {
              reportId: orderData.report_id,
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            };

            lastPaymentCredentialsRef.current = credentials;
            await verifyPayment(credentials);
          },
          modal: {
            ondismiss: () => {
              // Dismissal is cancellation; NEVER report success or auto-create another order
              setState("idle");
              isBusyRef.current = false;
            },
          },
          prefill: {
            name: prefill?.name,
            email: prefill?.email,
          },
          theme: {
            color: "#b4f437", // Verifii brand lime
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Unexpected checkout error";
        console.error("[Investor Report] Checkout initialization exception:", errMsg);
        setState("error");
        setError(errMsg);
        isBusyRef.current = false;
      }
    },
    [verifyPayment]
  );

  const retryGeneration = useCallback(async () => {
    if (!lastPaymentCredentialsRef.current) {
      setError("No active report payment credentials available to retry.");
      return;
    }

    if (isBusyRef.current) return;
    isBusyRef.current = true;

    await verifyPayment(lastPaymentCredentialsRef.current);
  }, [verifyPayment]);

  return {
    state,
    reportId,
    orderId,
    downloadUrl,
    error,
    startPurchase,
    retryGeneration,
    reset,
  };
}
