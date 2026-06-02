import type { ProviderKind, SnapshotBundle } from "./snapshots.js";

export interface RiskHint {
  provider?: ProviderKind;
  severity: "info" | "warning" | "critical";
  category: string;
  message: string;
}

export function evaluateRiskHints(_snapshots: SnapshotBundle): readonly RiskHint[] {
  return [];
}
