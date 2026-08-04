import type { Recommendation } from "./recommendations";

// ─── Insight Ranking ──────────────────────────────────────────────────
// Insights are positive findings — severity ordering is meaningless.
// Instead, rank by usefulness: impact score → evidence count → id.

/**
 * Default impact score when impactScore is not explicitly set on a recommendation.
 * Insights without an explicit score are treated as baseline importance.
 */
const DEFAULT_IMPACT_SCORE = 50;

/**
 * Compares two insight recommendations for display ordering.
 *
 * Ranking rules (all descending, except tertiary):
 *   1. PRIMARY:   impactScore descending (higher impact = more useful)
 *   2. SECONDARY: evidence count descending (more evidence = more informative)
 *   3. TERTIARY:  alphabetical id ascending (deterministic tie-breaker)
 */
export function compareInsights(
  a: Recommendation,
  b: Recommendation
): number {
  // 1. Impact score descending
  const impactA = a.impactScore ?? DEFAULT_IMPACT_SCORE;
  const impactB = b.impactScore ?? DEFAULT_IMPACT_SCORE;
  if (impactA !== impactB) return impactB - impactA;

  // 2. Evidence count descending
  const evidenceA = a.evidence ? a.evidence.length : 0;
  const evidenceB = b.evidence ? b.evidence.length : 0;
  if (evidenceA !== evidenceB) return evidenceB - evidenceA;

  // 3. Alphabetical id ascending
  return a.id.localeCompare(b.id);
}
