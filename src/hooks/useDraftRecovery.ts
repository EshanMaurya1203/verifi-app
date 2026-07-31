"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export const DRAFT_STORAGE_KEY = "verifii-onboarding-draft-v1";
export const DRAFT_VERSION = 1;
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface PersistedFormFields {
  fullName: string;
  startupName: string;
  website: string;
  businessType: string;
  mrr: string;
  arr: string;
  twitter: string;
  linkedin: string;
  cityCountry: string;
  notes: string;
  paymentMethods: string[];
  verificationType: string;
  apiProvider: string;
}

export interface DraftEnvelope {
  version: number;
  savedAt: string;
  step: number;
  data: PersistedFormFields;
}

function parseAndValidateDraft(raw: string | null): DraftEnvelope | null {
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw) as DraftEnvelope;

    if (!envelope || typeof envelope !== "object") return null;
    if (envelope.version !== DRAFT_VERSION) return null;
    if (!envelope.savedAt || typeof envelope.savedAt !== "string") return null;
    if (typeof envelope.step !== "number" || envelope.step < 1 || envelope.step > 4) return null;
    if (!envelope.data || typeof envelope.data !== "object") return null;

    const savedTime = new Date(envelope.savedAt).getTime();
    if (isNaN(savedTime)) return null;

    const age = Date.now() - savedTime;
    if (age > DRAFT_MAX_AGE_MS || age < 0) return null;

    return envelope;
  } catch {
    return null;
  }
}

export function useDraftRecovery(
  currentForm: PersistedFormFields,
  currentStep: number,
  isInitialized: boolean,
  hasInteracted: boolean
) {
  const [pendingDraft, setPendingDraft] = useState<DraftEnvelope | null>(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [hasCheckedDraft, setHasCheckedDraft] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const syncFromLocalStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      const validDraft = parseAndValidateDraft(raw);
      if (raw && !validDraft) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
      setPendingDraft(validDraft);
      if (!validDraft) {
        setIsBannerDismissed(false);
      }
    } catch {
      setPendingDraft(null);
      setIsBannerDismissed(false);
    }
  }, []);

  useEffect(() => {
    syncFromLocalStorage();
    setHasCheckedDraft(true);

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === DRAFT_STORAGE_KEY) {
        syncFromLocalStorage();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [syncFromLocalStorage]);

  useEffect(() => {
    // CRITICAL: Do NOT auto-save on initial load, empty form initialization, or before user interaction
    if (!isInitialized || !hasCheckedDraft || !hasInteracted) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        const envelope: DraftEnvelope = {
          version: DRAFT_VERSION,
          savedAt: new Date().toISOString(),
          step: currentStep,
          data: {
            fullName: currentForm.fullName || "",
            startupName: currentForm.startupName || "",
            website: currentForm.website || "",
            businessType: currentForm.businessType || "",
            mrr: currentForm.mrr || "",
            arr: currentForm.arr || "",
            twitter: currentForm.twitter || "",
            linkedin: currentForm.linkedin || "",
            cityCountry: currentForm.cityCountry || "",
            notes: currentForm.notes || "",
            paymentMethods: Array.isArray(currentForm.paymentMethods) ? currentForm.paymentMethods : [],
            verificationType: currentForm.verificationType || "",
            apiProvider: currentForm.apiProvider || "stripe",
          },
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(envelope));
        setPendingDraft(envelope);
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[DraftRecovery] Auto-save failed:", err);
        }
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentForm, currentStep, isInitialized, hasCheckedDraft, hasInteracted]);

  const restoreDraft = useCallback((): DraftEnvelope | null => {
    setIsBannerDismissed(true);
    return pendingDraft;
  }, [pendingDraft]);

  const discardDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
    setPendingDraft(null);
    setIsBannerDismissed(false);
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
    setPendingDraft(null);
    setIsBannerDismissed(false);
  }, []);

  const showBanner = pendingDraft !== null && !isBannerDismissed;

  return {
    pendingDraft,
    showBanner,
    restoreDraft,
    discardDraft,
    clearDraft,
  };
}
