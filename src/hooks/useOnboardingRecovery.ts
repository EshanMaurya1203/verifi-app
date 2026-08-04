"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { TimeRange } from "@/lib/analytics/types";
import type { AnalyticsFilters } from "@/lib/analytics/filters";
import type { RecoveryResponse } from "@/app/api/admin/analytics/onboarding/recovery/route";

export function useOnboardingRecovery(
  range: TimeRange,
  filters?: AnalyticsFilters
): {
  data: RecoveryResponse | null;
  isLoading: boolean;
  isError: boolean;
} {
  const [data, setData] = useState<RecoveryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  const activeRequestRef = useRef<AbortController | null>(null);

  const provider = filters?.provider || "all";
  const outcome = filters?.outcome || "all";

  const fetchRecovery = useCallback(
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
          `/api/admin/analytics/onboarding/recovery?${queryParams.toString()}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error("Failed to fetch recovery analytics");
        }

        const resData: RecoveryResponse = await res.json();
        setData(resData);
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
    fetchRecovery(range, provider, outcome);
    return () => {
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
      }
    };
  }, [range, provider, outcome, fetchRecovery]);

  return {
    data,
    isLoading,
    isError,
  };
}
