import type { StartupStatus } from "./startup-status";

export interface Milestone {
  id: string;
  label: string;
  weight: number;
  completed: boolean;
}

export interface ProgressResult {
  percentage: number;
  completedMilestones: Milestone[];
  remainingMilestones: Milestone[];
  allMilestones: Milestone[];
  completedCount: number;
  remainingCount: number;
  nextMilestone: Milestone | null;
}

interface MilestoneConfig {
  id: string;
  label: string;
  weight: number;
  resolve: (status: StartupStatus) => boolean;
}

const MILESTONE_CONFIGS: MilestoneConfig[] = [
  {
    id: "basic_profile",
    label: "Basic Profile Complete",
    weight: 15,
    resolve: (status) => status.profile === "complete",
  },
  {
    id: "revenue_declared",
    label: "Revenue Declared",
    weight: 15,
    resolve: (status) => status.revenue !== "undeclared",
  },
  {
    id: "proof_uploaded",
    label: "Proof Uploaded",
    weight: 15,
    resolve: (status) => status.proof === "submitted" || status.payment === "connected" || status.verification === "verified",
  },
  {
    id: "payment_connected",
    label: "Payment Provider Connected",
    weight: 20,
    resolve: (status) => status.payment === "connected",
  },
  {
    id: "verification_complete",
    label: "Verification Complete",
    weight: 20,
    resolve: (status) => status.verification === "verified",
  },
  {
    id: "startup_published",
    label: "Startup Published",
    weight: 15,
    resolve: (status) => status.publication === "public",
  }
];

export function getFounderProgress(status: StartupStatus): ProgressResult {
  if (!status) {
    return {
      percentage: 0,
      completedMilestones: [],
      remainingMilestones: [],
      allMilestones: [],
      completedCount: 0,
      remainingCount: 0,
      nextMilestone: null,
    };
  }

  const evaluated: Milestone[] = MILESTONE_CONFIGS.map(config => ({
    id: config.id,
    label: config.label,
    weight: config.weight,
    completed: config.resolve(status)
  }));

  const completedMilestones = evaluated.filter(m => m.completed);
  const remainingMilestones = evaluated.filter(m => !m.completed);
  
  const percentage = evaluated.reduce((total, m) => total + (m.completed ? m.weight : 0), 0);

  return {
    percentage: Math.min(percentage, 100),
    completedMilestones,
    remainingMilestones,
    allMilestones: evaluated,
    completedCount: completedMilestones.length,
    remainingCount: remainingMilestones.length,
    nextMilestone: remainingMilestones[0] || null,
  };
}
