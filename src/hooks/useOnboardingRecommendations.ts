"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { TimeRange } from "@/lib/analytics/types";
import type { AnalyticsFilters } from "@/lib/analytics/filters";
import type { RecommendationsResponse } from "@/app/api/admin/analytics/onboarding/recommendations/route";

export function useOnboardingRecommendations(
  range: TimeRange,
  filters?: AnalyticsFilters
): {
  data: RecommendationsResponse | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  const activeRequestRef = useRef<AbortController | null>(null);

  const provider = filters?.provider || "all";
  const outcome = filters?.outcome || "all";

  const fetchRecommendations = useCallback(
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
          `/api/admin/analytics/onboarding/recommendations?${queryParams.toString()}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error("Failed to fetch recommendations");
        }

        const resData: RecommendationsResponse = await res.json();
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
    fetchRecommendations(range, provider, outcome);
    return () => {
      if (activeRequestRef.current) {
        activeRequestRef.current.abort();
      }
    };
  }, [range, provider, outcome, fetchRecommendations]);

  const refetch = useCallback(async () => {
    await fetchRecommendations(range, provider, outcome);
  }, [range, provider, outcome, fetchRecommendations]);

  return {
    data,
    isLoading,
    isError,
    refetch,
  };
}
