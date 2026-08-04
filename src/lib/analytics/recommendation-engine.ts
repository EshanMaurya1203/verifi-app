import type { DiagnosticsReport } from "./diagnostics";
import type { ProviderMetrics } from "./provider-intelligence";
import type { RecoveryReport } from "./recovery-metrics";
import type { RiskSignal } from "./risk-scoring";
import { buildRecommendationKey, InvalidRecommendationTargetError } from "./recommendation-key";
import { areConflicting } from "./recommendation-conflicts";
import { compareInsights } from "./insight-ranking";
import type {
  Recommendation,
  RecommendationCategory,
  RecommendationSeverity,
} from "./recommendations";

import { detectFrictionPoints } from "./friction-detector";
import { analyzeProviders } from "./provider-intelligence";
import { analyzeRecovery } from "./recovery-intelligence";
import { generateRiskRecommendations } from "./risk-scoring";

export const MAX_WARNINGS = 10;
export const MAX_INSIGHTS = 3;

export interface RecommendationInput {
  diagnostics: DiagnosticsReport;
  recovery: RecoveryReport;
  providerMetrics: ProviderMetrics[];
  riskSignals: RiskSignal[];
}

export interface RecommendationResult {
  warnings: Recommendation[];
  insights: Recommendation[];
}

const SEVERITY_WEIGHT: Record<RecommendationSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const CATEGORY_WEIGHT: Record<RecommendationCategory, number> = {
  friction: 5,
  provider: 4,
  recovery: 3,
  dropoff: 2,
  conversion: 1,
};

function getSeverityScore(severity: RecommendationSeverity): number {
  return SEVERITY_WEIGHT[severity] ?? 0;
}

function getCategoryScore(category: RecommendationCategory): number {
  return CATEGORY_WEIGHT[category] ?? 0;
}

/**
 * Compares two recommendations by strength:
 * 1. Severity weight descending (critical > high > medium > low)
 * 2. Category weight descending (friction > provider > recovery > dropoff > conversion)
 * 3. ID ascending (alphabetical tie-breaker)
 */
export function compareRecommendationStrength(
  a: Recommendation,
  b: Recommendation
): number {
  const sevA = getSeverityScore(a.severity);
  const sevB = getSeverityScore(b.severity);
  if (sevA !== sevB) return sevB - sevA;

  const catA = getCategoryScore(a.category);
  const catB = getCategoryScore(b.category);
  if (catA !== catB) return catB - catA;

  return a.id.localeCompare(b.id);
}

/**
 * Deduplicates recommendations by entity target key (buildRecommendationKey(target)).
 * Retains the strongest recommendation and merges evidence arrays.
 *
 * Recommendations with invalid targets are excluded and logged — they do
 * not silently collapse into a shared bucket.
 */
export function deduplicateRecommendations(
  recommendations: Recommendation[]
): Recommendation[] {
  if (!recommendations || recommendations.length === 0) return [];

  const grouped = new Map<string, Recommendation[]>();

  for (const rec of recommendations) {
    let key: string;
    try {
      key = buildRecommendationKey(rec.target);
    } catch (err) {
      if (err instanceof InvalidRecommendationTargetError) {
        console.error(
          `[RecommendationEngine] Skipping recommendation "${rec.id}": ${err.message}`
        );
        continue;
      }
      throw err;
    }
    const existing = grouped.get(key) || [];
    existing.push(rec);
    grouped.set(key, existing);
  }

  const result: Recommendation[] = [];

  for (const group of grouped.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    // Sort group to pick the strongest recommendation first
    group.sort(compareRecommendationStrength);
    const strongest = { ...group[0] };

    // Merge evidence arrays without duplicates
    const allEvidence = group.flatMap((g) => g.evidence || []);
    strongest.evidence = Array.from(new Set(allEvidence));

    result.push(strongest);
  }

  return result;
}

/**
 * Resolves conflicts between recommendations using the centralized conflict registry.
 * If A conflicts with B, keeps the stronger recommendation and suppresses the weaker one.
 * Conflict matching is symmetric via areConflicting().
 */
export function resolveConflicts(
  recommendations: Recommendation[]
): Recommendation[] {
  if (!recommendations || recommendations.length === 0) return [];

  const suppressed = new Set<string>();

  for (let i = 0; i < recommendations.length; i++) {
    const recA = recommendations[i];
    if (suppressed.has(recA.id)) continue;

    for (let j = i + 1; j < recommendations.length; j++) {
      const recB = recommendations[j];
      if (suppressed.has(recB.id)) continue;

      if (areConflicting(recA, recB)) {
        // Compare strength to determine winner
        const diff = compareRecommendationStrength(recA, recB);
        if (diff <= 0) {
          // recA is stronger or equal (by id comparison) -> suppress recB
          suppressed.add(recB.id);
        } else {
          // recB is stronger -> suppress recA
          suppressed.add(recA.id);
          break;
        }
      }
    }
  }

  return recommendations.filter((r) => !suppressed.has(r.id));
}

/**
 * Main recommendation engine builder pipeline:
 * analytics -> generate -> deduplicate (with invalid target exclusion) ->
 * resolve conflicts -> sort -> split warnings & insights -> truncate -> result
 */
export function buildRecommendations(
  input: RecommendationInput
): RecommendationResult {
  if (!input) {
    return { warnings: [], insights: [] };
  }

  // 1. Generate candidate recommendations
  const rawCandidates: Recommendation[] = [
    ...detectFrictionPoints(input.diagnostics),
    ...analyzeProviders(input.providerMetrics),
    ...analyzeRecovery(input.recovery),
    ...generateRiskRecommendations(input.riskSignals),
  ];

  // 2. Deduplicate by entity key (invalid targets are excluded, not collapsed)
  const deduplicated = deduplicateRecommendations(rawCandidates);

  // 3. Explicit conflict resolution via centralized registry
  const resolved = resolveConflicts(deduplicated);

  // 4. Split into warnings vs insights
  const warningsRaw = resolved.filter((r) => r.kind === "warning");
  const insightsRaw = resolved.filter((r) => r.kind === "insight");

  // 5. Sort: warnings by severity strength, insights by impact score
  warningsRaw.sort(compareRecommendationStrength);
  insightsRaw.sort(compareInsights);

  // 6. Truncate separately
  const warnings = warningsRaw.slice(0, MAX_WARNINGS);
  const insights = insightsRaw.slice(0, MAX_INSIGHTS);

  return {
    warnings,
    insights,
  };
}
