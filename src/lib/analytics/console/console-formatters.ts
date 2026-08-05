// ─── VRF-ONBOARD-003E / 003E.2 — Console Formatters ────────────────────────

import type { ExperimentConsoleView, AuditConsoleView } from "./console-types";

/**
 * Formats an ExperimentConsoleView into a clean ASCII text representation.
 */
export function formatConsoleView(view: ExperimentConsoleView): string {
  if (!view) {
    return "[Empty Console View]";
  }

  const lines: string[] = [];
  lines.push(`=== EXPERIMENT CONSOLE VIEW: ${view.experimentId} ===`);
  lines.push(`Name:      ${view.name}`);
  lines.push(`Owner ID:  ${view.ownerId}`);
  lines.push(`Status:    ${view.status}`);
  lines.push(`Version:   v${view.version}`);
  lines.push(`Created:   ${view.createdAt.toISOString()}`);
  lines.push(`Updated:   ${view.updatedAt.toISOString()}`);

  lines.push(`\n--- VARIANTS (${view.variants.length}) ---`);
  for (const v of view.variants) {
    lines.push(`  - ${v.id}: "${v.name}" (${v.weight}%)`);
  }

  lines.push(`\n--- TARGETING ---`);
  lines.push(`  Eligible:      ${view.targeting.eligible}`);
  lines.push(`  Matched Rules: ${view.targeting.matchedRules.join(", ") || "none"}`);
  lines.push(`  Failed Rules:  ${view.targeting.failedRules.join(", ") || "none"}`);

  lines.push(`\n--- SCHEDULE ---`);
  lines.push(`  Active:         ${view.schedule.active}`);
  lines.push(`  Matched Checks: ${view.schedule.matchedChecks.join(", ") || "none"}`);
  lines.push(`  Failed Checks:  ${view.schedule.failedChecks.join(", ") || "none"}`);

  lines.push(`\n--- GOVERNANCE PERMISSIONS ---`);
  lines.push(`  Allowed Actions: ${view.governance.allowedActions.join(", ") || "none"}`);

  lines.push(`\n--- AUDIT TRAIL (${view.audit.length}) ---`);
  lines.push(formatAuditView(view.audit));

  return lines.join("\n");
}

/**
 * Formats AuditConsoleView entries into clean ASCII lines.
 */
export function formatAuditView(audit: readonly AuditConsoleView[]): string {
  if (!audit || audit.length === 0) {
    return "  (no audit entries)";
  }

  return audit
    .map((a) => `  [#${a.sequence}] ${a.timestamp.toISOString()} | ${a.actorId} -> ${a.action}${a.reason ? ` (${a.reason})` : ""}`)
    .join("\n");
}

/**
 * Generates a short single-line summary of an ExperimentConsoleView presentation.
 */
export function summarizeConsoleView(view: ExperimentConsoleView): string {
  if (!view) return "[Empty View]";
  return `Exp: ${view.experimentId} (v${view.version}, ${view.status}) | Active: ${view.schedule.active} | Eligible: ${view.targeting.eligible} | Allowed: [${view.governance.allowedActions.join(", ")}]`;
}
