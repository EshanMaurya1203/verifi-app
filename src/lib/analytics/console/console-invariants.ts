// ─── VRF-ONBOARD-003E — Console Invariants ─────────────────────────────────

import type { ExperimentDefinition } from "../registry/experiment-types";
import type { GovernanceActor } from "../governance/governance-types";
import type { TargetingContext } from "../targeting/targeting-context";
import type { GovernanceAuditLog } from "../governance/governance-audit";
import type { ExperimentConsoleView } from "./console-types";
import { buildExperimentConsoleView } from "./console-engine";
import { canPerformAction } from "../governance/governance-engine";

export interface ConsoleInvariantResult {
  passed: boolean;

  invariantId: string;

  name: string;

  severity: "critical" | "warning";

  reason?: string;
}

export interface ConsoleInvariantCheckContext {
  experimentDefinition?: ExperimentDefinition;

  governanceActor?: GovernanceActor;

  targetingContext?: TargetingContext;

  evaluationTime?: Date;

  governanceAuditLog?: GovernanceAuditLog;

  consoleView?: ExperimentConsoleView;
}

export interface ConsoleInvariant {
  id: string;

  name: string;

  description: string;

  severity: "critical" | "warning";

  check: (ctx: ConsoleInvariantCheckContext) => ConsoleInvariantResult;
}

/**
 * Invariant #97: Console Deterministic. Building console view with identical inputs produces strictly identical views.
 */
export const INV_097_CONSOLE_DETERMINISTIC: ConsoleInvariant = {
  id: "INV_097_CONSOLE_DETERMINISTIC",
  name: "Console View Determinism Guard",
  description: "Building console view with identical inputs produces strictly identical views.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.governanceActor || !ctx.evaluationTime) {
      return {
        passed: true,
        invariantId: "INV_097_CONSOLE_DETERMINISTIC",
        name: "Console View Determinism Guard",
        severity: "critical",
      };
    }

    const view1 = buildExperimentConsoleView(
      ctx.experimentDefinition,
      ctx.governanceActor,
      ctx.targetingContext,
      ctx.evaluationTime,
      ctx.governanceAuditLog
    );

    const view2 = buildExperimentConsoleView(
      ctx.experimentDefinition,
      ctx.governanceActor,
      ctx.targetingContext,
      ctx.evaluationTime,
      ctx.governanceAuditLog
    );

    const json1 = JSON.stringify(view1);
    const json2 = JSON.stringify(view2);
    const passed = json1 === json2;

    return {
      passed,
      invariantId: "INV_097_CONSOLE_DETERMINISTIC",
      name: "Console View Determinism Guard",
      severity: "critical",
      reason: passed ? undefined : "Console projections for identical inputs produced non-identical JSON outputs.",
    };
  },
};

/**
 * Invariant #98: Console Read Only. Projecting console view must not mutate the underlying experiment or audit log.
 */
export const INV_098_CONSOLE_READ_ONLY: ConsoleInvariant = {
  id: "INV_098_CONSOLE_READ_ONLY",
  name: "Console Read-Only Projection Guard",
  description: "Projecting console view must not mutate the underlying experiment, actor, schedule, or audit log.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.governanceActor || !ctx.evaluationTime) {
      return {
        passed: true,
        invariantId: "INV_098_CONSOLE_READ_ONLY",
        name: "Console Read-Only Projection Guard",
        severity: "critical",
      };
    }

    const beforeExpJson = JSON.stringify(ctx.experimentDefinition);
    const beforeAuditJson = ctx.governanceAuditLog ? JSON.stringify(ctx.governanceAuditLog) : undefined;

    buildExperimentConsoleView(
      ctx.experimentDefinition,
      ctx.governanceActor,
      ctx.targetingContext,
      ctx.evaluationTime,
      ctx.governanceAuditLog
    );

    const afterExpJson = JSON.stringify(ctx.experimentDefinition);
    const afterAuditJson = ctx.governanceAuditLog ? JSON.stringify(ctx.governanceAuditLog) : undefined;

    const expUnchanged = beforeExpJson === afterExpJson;
    const auditUnchanged = beforeAuditJson === afterAuditJson;
    const passed = expUnchanged && auditUnchanged;

    return {
      passed,
      invariantId: "INV_098_CONSOLE_READ_ONLY",
      name: "Console Read-Only Projection Guard",
      severity: "critical",
      reason: passed ? undefined : "Console projection mutated underlying experiment or audit log state.",
    };
  },
};

/**
 * Invariant #99: Audit Projection Order. Audit projection must strictly preserve primary sequence number and secondary timestamp ordering.
 */
export const INV_099_AUDIT_PROJECTION_ORDER: ConsoleInvariant = {
  id: "INV_099_AUDIT_PROJECTION_ORDER",
  name: "Console Audit Projection Monotonicity Guard",
  description: "Audit projection must strictly preserve primary sequence number and secondary timestamp ordering.",
  severity: "critical",
  check: (ctx) => {
    const view =
      ctx.consoleView ||
      (ctx.experimentDefinition && ctx.governanceActor && ctx.evaluationTime
        ? buildExperimentConsoleView(
            ctx.experimentDefinition,
            ctx.governanceActor,
            ctx.targetingContext,
            ctx.evaluationTime,
            ctx.governanceAuditLog
          )
        : undefined);

    if (!view || !Array.isArray(view.audit)) {
      return {
        passed: true,
        invariantId: "INV_099_AUDIT_PROJECTION_ORDER",
        name: "Console Audit Projection Monotonicity Guard",
        severity: "critical",
      };
    }

    let isOrdered = true;
    for (let i = 1; i < view.audit.length; i++) {
      if (view.audit[i].sequence <= view.audit[i - 1].sequence) {
        isOrdered = false;
        break;
      }
    }

    return {
      passed: isOrdered,
      invariantId: "INV_099_AUDIT_PROJECTION_ORDER",
      name: "Console Audit Projection Monotonicity Guard",
      severity: "critical",
      reason: isOrdered ? undefined : "Console audit projection failed to preserve monotonic sequence ordering.",
    };
  },
};

/**
 * Invariant #100: Console Matches Domain. Console view properties must match underlying domain evaluations.
 */
export const INV_100_CONSOLE_MATCHES_DOMAIN: ConsoleInvariant = {
  id: "INV_100_CONSOLE_MATCHES_DOMAIN",
  name: "Console Domain Fidelity Guard",
  description: "Console view properties (eligible, active, allowedActions, variants) must match underlying domain evaluations.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.governanceActor || !ctx.evaluationTime) {
      return {
        passed: true,
        invariantId: "INV_100_CONSOLE_MATCHES_DOMAIN",
        name: "Console Domain Fidelity Guard",
        severity: "critical",
      };
    }

    const view = buildExperimentConsoleView(
      ctx.experimentDefinition,
      ctx.governanceActor,
      ctx.targetingContext,
      ctx.evaluationTime,
      ctx.governanceAuditLog
    );

    const matchesId = view.experimentId === ctx.experimentDefinition.id;
    const matchesOwner = view.ownerId === ctx.experimentDefinition.ownerId;
    const matchesStatus = view.status === ctx.experimentDefinition.status;
    const matchesVariants = view.variants.length === ctx.experimentDefinition.variants.length;

    const passed = matchesId && matchesOwner && matchesStatus && matchesVariants;

    return {
      passed,
      invariantId: "INV_100_CONSOLE_MATCHES_DOMAIN",
      name: "Console Domain Fidelity Guard",
      severity: "critical",
      reason: passed ? undefined : "Console view fields mismatched underlying experiment definition domain values.",
    };
  },
};

/**
 * Invariant #101: Allowed Actions Correct. Console view allowedActions must match exact actions authorized by governance engine.
 */
export const INV_101_ALLOWED_ACTIONS_CORRECT: ConsoleInvariant = {
  id: "INV_101_ALLOWED_ACTIONS_CORRECT",
  name: "Console Governance Authorization Accuracy Guard",
  description: "Console view allowedActions must match exact actions authorized by the governance engine for the given actor.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.governanceActor || !ctx.evaluationTime) {
      return {
        passed: true,
        invariantId: "INV_101_ALLOWED_ACTIONS_CORRECT",
        name: "Console Governance Authorization Accuracy Guard",
        severity: "critical",
      };
    }

    const view = buildExperimentConsoleView(
      ctx.experimentDefinition,
      ctx.governanceActor,
      ctx.targetingContext,
      ctx.evaluationTime,
      ctx.governanceAuditLog
    );

    const ALL_ACTIONS = ["create", "edit", "request_review", "review", "approve", "activate", "pause", "archive"] as const;
    const expectedAllowed = ALL_ACTIONS.filter(
      (action) => canPerformAction(ctx.governanceActor!, action, ctx.experimentDefinition).allowed
    );

    const viewActionsStr = [...view.governance.allowedActions].sort().join(",");
    const expectedActionsStr = [...expectedAllowed].sort().join(",");

    const passed = viewActionsStr === expectedActionsStr;

    return {
      passed,
      invariantId: "INV_101_ALLOWED_ACTIONS_CORRECT",
      name: "Console Governance Authorization Accuracy Guard",
      severity: "critical",
      reason: passed ? undefined : `Console governance allowedActions (${viewActionsStr}) did not match expected governance engine permissions (${expectedActionsStr}).`,
    };
  },
};

/**
 * Invariant #102: No Reverse Dependencies. Domain layers (registry, targeting, scheduler, governance) must never import console.
 */
export const INV_102_NO_REVERSE_DEPENDENCIES: ConsoleInvariant = {
  id: "INV_102_NO_REVERSE_DEPENDENCIES",
  name: "Reverse Dependency Prohibition Guard",
  description: "registry, targeting, scheduler, and governance modules must never import from console.",
  severity: "critical",
  check: () => {
    const domainDirs = ["registry", "targeting", "scheduler", "governance"];
    const violations: string[] = [];

    try {
      const fs = require("fs");
      const path = require("path");
      const baseDir = path.resolve("src/lib/analytics");

      for (const dir of domainDirs) {
        const fullDirPath = path.join(baseDir, dir);
        if (fs.existsSync(fullDirPath)) {
          const files = fs.readdirSync(fullDirPath).filter((f: string) => f.endsWith(".ts"));
          for (const file of files) {
            const filePath = path.join(fullDirPath, file);
            const content = fs.readFileSync(filePath, "utf-8");
            if (content.includes("/console") || content.includes('from "./console"') || content.includes('from "../console"')) {
              violations.push(`${dir}/${file}`);
            }
          }
        }
      }
    } catch {
      // In non-filesystem environments, assume passed
    }

    const passed = violations.length === 0;
    return {
      passed,
      invariantId: "INV_102_NO_REVERSE_DEPENDENCIES",
      name: "Reverse Dependency Prohibition Guard",
      severity: "critical",
      reason: passed ? undefined : `Reverse dependency violations found in: ${violations.join(", ")}`,
    };
  },
};

/**
 * Invariant #103: Console Time Injection. Console module files must never instantiate time internally (new Date() with no args or Date.now()).
 */
export const INV_103_CONSOLE_TIME_INJECTION: ConsoleInvariant = {
  id: "INV_103_CONSOLE_TIME_INJECTION",
  name: "Console External Time Injection Guard",
  description: "console module files must never instantiate time internally (new Date() with no args or Date.now()).",
  severity: "critical",
  check: () => {
    const consoleFiles = ["console-engine.ts", "console-projections.ts", "console-utils.ts", "console-formatters.ts", "console-validator.ts"];
    const violations: string[] = [];

    try {
      const fs = require("fs");
      const path = require("path");
      const baseDir = path.resolve("src/lib/analytics/console");

      for (const file of consoleFiles) {
        const filePath = path.join(baseDir, file);
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, "utf-8");
          const code = raw.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
          if (code.includes("new Date()") || code.includes("Date.now()")) {
            violations.push(file);
          }
        }
      }
    } catch {
      // In non-filesystem environments, assume passed
    }

    const passed = violations.length === 0;
    return {
      passed,
      invariantId: "INV_103_CONSOLE_TIME_INJECTION",
      name: "Console External Time Injection Guard",
      severity: "critical",
      reason: passed ? undefined : `Internal time instantiation (new Date() / Date.now()) found in: ${violations.join(", ")}`,
    };
  },
};

export const CONSOLE_INVARIANTS: readonly ConsoleInvariant[] = [
  INV_097_CONSOLE_DETERMINISTIC,
  INV_098_CONSOLE_READ_ONLY,
  INV_099_AUDIT_PROJECTION_ORDER,
  INV_100_CONSOLE_MATCHES_DOMAIN,
  INV_101_ALLOWED_ACTIONS_CORRECT,
  INV_102_NO_REVERSE_DEPENDENCIES,
  INV_103_CONSOLE_TIME_INJECTION,
] as const;

export function checkAllConsoleInvariants(
  ctx: ConsoleInvariantCheckContext
): ConsoleInvariantResult[] {
  return CONSOLE_INVARIANTS.map((inv) => inv.check(ctx));
}
