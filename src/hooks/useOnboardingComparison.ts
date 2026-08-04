"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { TimeRange } from "@/lib/analytics/types";
import type { ComparisonReport } from "@/lib/analytics/comparison";
import type { AnalyticsFilters } from "@/lib/analytics/filters";

export function useOnboardingComparison(
  range: TimeRange,
  filters?: AnalyticsFilters
): {
  comparison: ComparisonReport | null;
  isLoading: boolean;
  isError: boolean;
} {
  const [comparison, setComparison] = useState<ComparisonReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  const activeRequestRef = useRef<AbortController | null>(null);

  const provider = filters?.provider || "all";
  const outcome = filters?.outcome || "all";

  const fetchComparison = useCallback(
    async (selectedRange: TimeRange, selectedProvider: string, selectedOutcome: string) => {
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
      }

      const controller = new AbortController();
      activeRequestRef.current = controller;

      setIsLoading(true);
      setIsError(false);

      try {
        const queryParams = new URLSearchParams({
          range: selectedRange,
          provider: selectedProvider,
          outcome: selectedOutcome,
        });

        const res = await fetch(
          `/api/admin/analytics/onboarding/comparison?${queryParams.toString()}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error("Failed to fetch period comparison");
        }

        const data: ComparisonReport = await res.json();
        setComparison(data);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setIsError(true);
      } finally {
        setIsLoading(false);
        if (activeRequestRef.current === controller) {
          activeRequestRef.current = null;
        }
      }
    },
    []
  );

  useEffect(() => {
    fetchComparison(range, provider, outcome);
    return () => {
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
      }
    };
  }, [range, provider, outcome, fetchComparison]);

  return {
    comparison,
    isLoading,
    isError,
  };
}
