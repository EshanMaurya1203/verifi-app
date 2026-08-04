"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { TimeRange, OnboardingMetricsReport } from "@/lib/analytics/types";
import type { AnalyticsFilters } from "@/lib/analytics/filters";

export function useOnboardingAnalytics(
  range: TimeRange,
  filters?: AnalyticsFilters
): {
  report: OnboardingMetricsReport | null;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  retry: () => Promise<void>;
} {
  const [report, setReport] = useState<OnboardingMetricsReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [isRefetching, setIsRefetching] = useState<boolean>(false);

  const activeRequestRef = useRef<AbortController | null>(null);

  const provider = filters?.provider || "all";
  const outcome = filters?.outcome || "all";

  const fetchAnalytics = useCallback(
    async (selectedRange: TimeRange, selectedProvider: string, selectedOutcome: string, isManualRetry = false) => {
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
      }

      const controller = new AbortController();
      activeRequestRef.current = controller;

      if (isManualRetry) {
        setIsRefetching(true);
      } else if (!report) {
        setIsLoading(true);
      } else {
        setIsRefetching(true);
      }

      setIsError(false);

      try {
        const queryParams = new URLSearchParams({
          range: selectedRange,
          provider: selectedProvider,
          outcome: selectedOutcome,
        });

        const res = await fetch(
          `/api/admin/analytics/onboarding?${queryParams.toString()}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error("Failed to fetch analytics");
        }

        const data: OnboardingMetricsReport = await res.json();
        setReport(data);
        setIsError(false);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setIsError(true);
      } finally {
        setIsLoading(false);
        setIsRefetching(false);
        if (activeRequestRef.current === controller) {
          activeRequestRef.current = null;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    fetchAnalytics(range, provider, outcome, false);
    return () => {
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
      }
    };
  }, [range, provider, outcome, fetchAnalytics]);

  const retry = useCallback(async () => {
    await fetchAnalytics(range, provider, outcome, true);
  }, [range, provider, outcome, fetchAnalytics]);

  return {
    report,
    isLoading,
    isError,
    isRefetching,
    retry,
  };
}
