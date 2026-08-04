"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { TimeRange } from "@/lib/analytics/types";
import type { AnalyticsFilters } from "@/lib/analytics/filters";
import type { DiagnosticsResponse } from "@/app/api/admin/analytics/onboarding/diagnostics/route";

export function useOnboardingDiagnostics(
  range: TimeRange,
  filters?: AnalyticsFilters
): {
  data: DiagnosticsResponse | null;
  isLoading: boolean;
  isError: boolean;
} {
  const [data, setData] = useState<DiagnosticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  const activeRequestRef = useRef<AbortController | null>(null);

  const provider = filters?.provider || "all";
  const outcome = filters?.outcome || "all";

  const fetchDiagnostics = useCallback(
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
          `/api/admin/analytics/onboarding/diagnostics?${queryParams.toString()}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error("Failed to fetch diagnostics");
        }

        const resData: DiagnosticsResponse = await res.json();
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
    fetchDiagnostics(range, provider, outcome);
    return () => {
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
      }
    };
  }, [range, provider, outcome, fetchDiagnostics]);

  return {
    data,
    isLoading,
    isError,
  };
}
