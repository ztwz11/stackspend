import type { Alert, CollectionStatus, ProviderKind, SnapshotBundle } from "./snapshots.js";

export interface ProviderCollectionContext {
  now(): Date;
}

export interface ProviderCollectionResult {
  collectedAt: string;
  status: CollectionStatus;
  snapshots: SnapshotBundle;
  alerts: readonly Alert[];
  errors?: readonly string[];
}

export interface ProviderConnector {
  kind: ProviderKind;
  displayName: string;
  access: "read-only";
  collect(context: ProviderCollectionContext): Promise<ProviderCollectionResult>;
}
