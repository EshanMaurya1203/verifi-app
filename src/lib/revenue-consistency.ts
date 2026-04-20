/**
 * Revenue Consistency Engine
 * Analyzes the variance in historical revenue events to determine financial stability.
 * Returns a score between 0 (highly volatile/low data) and 1 (stable/consistent growth).
 */
export function calculateConsistency(events: any[]) {
  if (!events || events.length < 3) return 0.2;

  const amounts = events.map(e => Number(e.amount));

  const avg =
    amounts.reduce((a, b) => a + b, 0) / amounts.length;

  if (avg === 0) return 0;

  const variance =
    amounts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
    amounts.length;

  const stdDev = Math.sqrt(variance);

  // Consistency is inverted volatility
  const consistencyScore = 1 - stdDev / avg;

  return Math.max(0, Math.min(1, consistencyScore));
}
