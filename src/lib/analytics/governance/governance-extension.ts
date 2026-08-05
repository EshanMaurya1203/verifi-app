// ─── VRF-ONBOARD-003D / 003D.1 — Governance Extension Points ───────────────

/**
 * Architectural Placeholders for Future Multi-Tenant & SaaS Governance.
 * DO NOT integrate into current runtime.
 */

export type PlatformRole =
  | "user"
  | "moderator"
  | "admin"
  | "super_admin";

export type OwnerType =
  | "user"
  | "organization";

export interface ExperimentOwner {
  type: OwnerType;

  id: string;
}

export interface Organization {
  id: string;

  name: string;

  ownerId: string;
}

export interface OrganizationMembership {
  organizationId: string;

  userId: string;

  role:
    | "owner"
    | "manager"
    | "editor"
    | "viewer";
}
