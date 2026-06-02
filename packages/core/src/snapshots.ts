export type ProviderKind = "mock" | "aws" | "openai" | "supabase" | "cloudflare";

export type CollectionStatus = "ok" | "partial" | "error";

export interface SnapshotBase {
  provider: ProviderKind;
  collectedAt: string;
  providerAccountRef?: string;
  service?: string;
}

export interface UsageSnapshot extends SnapshotBase {
  metric: string;
  unit: string;
  value: number;
}

export interface BillingSnapshot extends SnapshotBase {
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
  status: string;
}

export interface ServiceHealthSnapshot extends SnapshotBase {
  service: string;
  region?: string;
  status: "ok" | "degraded" | "down" | "unknown";
  message?: string;
}

export interface CostEstimate extends SnapshotBase {
  periodStart: string;
  periodEnd: string;
  estimatedAmountMinor: number;
  currency: string;
  confidence: "low" | "medium" | "high";
}

export interface Alert {
  provider?: ProviderKind;
  createdAt: string;
  severity: "info" | "warning" | "critical";
  category: string;
  title: string;
  message: string;
}

export interface SnapshotBundle {
  usage: readonly UsageSnapshot[];
  billing: readonly BillingSnapshot[];
  serviceHealth: readonly ServiceHealthSnapshot[];
  costEstimates: readonly CostEstimate[];
}

export function createEmptySnapshotBundle(): SnapshotBundle {
  return {
    usage: [],
    billing: [],
    serviceHealth: [],
    costEstimates: [],
  };
}
