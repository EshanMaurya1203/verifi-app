"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { TimeRange } from "@/lib/analytics/types";
import type { TrendReport } from "@/lib/analytics/trends";
import type { AnalyticsFilters } from "@/lib/analytics/filters";

export function useOnboardingTrends(
  range: TimeRange,
  filters?: AnalyticsFilters
): {
  trends: TrendReport | null;
  isLoading: boolean;
  isError: boolean;
} {
  const [trends, setTrends] = useState<TrendReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  const activeRequestRef = useRef<AbortController | null>(null);

  const provider = filters?.provider || "all";
  const outcome = filters?.outcome || "all";

  const fetchTrends = useCallback(
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
          `/api/admin/analytics/onboarding/trends?${queryParams.toString()}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error("Failed to fetch trends");
        }

        const data: TrendReport = await res.json();
        setTrends(data);
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
    fetchTrends(range, provider, outcome);
    return () => {
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
      }
    };
  }, [range, provider, outcome, fetchTrends]);

  return {
    trends,
    isLoading,
    isError,
  };
}
