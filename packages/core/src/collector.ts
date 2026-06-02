import type { Alert, CollectionStatus, ProviderKind, SnapshotBundle } from "./snapshots.js";
import type { ProviderCollectionContext, ProviderConnector } from "./provider.js";

export interface CollectedProviderSnapshots {
  provider: ProviderKind;
  collectedAt: string;
  status: CollectionStatus;
  snapshots: SnapshotBundle;
  alerts: readonly Alert[];
  errors?: readonly string[];
}

const DEFAULT_COLLECTION_CONTEXT: ProviderCollectionContext = {
  now: () => new Date(),
};

export async function collectProviderSnapshots(
  provider: ProviderConnector,
  context: ProviderCollectionContext = DEFAULT_COLLECTION_CONTEXT,
): Promise<CollectedProviderSnapshots> {
  if (provider.access !== "read-only") {
    throw new Error(`Provider ${provider.displayName} must be read-only.`);
  }

  const result = await provider.collect(context);
  assertNoRawProviderPayload(result.snapshots);
  assertSnapshotProvider(result.snapshots, provider.kind);

  const collected: CollectedProviderSnapshots = {
    provider: provider.kind,
    collectedAt: result.collectedAt,
    status: result.status,
    snapshots: result.snapshots,
    alerts: result.alerts,
  };

  if (result.errors !== undefined) {
    return {
      ...collected,
      errors: result.errors,
    };
  }

  return collected;
}

function assertSnapshotProvider(snapshots: SnapshotBundle, provider: ProviderKind): void {
  const snapshotGroups = [
    ...snapshots.usage,
    ...snapshots.billing,
    ...snapshots.serviceHealth,
    ...snapshots.costEstimates,
  ];

  for (const snapshot of snapshotGroups) {
    if (snapshot.provider !== provider) {
      throw new Error(`Snapshot provider ${snapshot.provider} does not match connector ${provider}.`);
    }
  }
}

function assertNoRawProviderPayload(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoRawProviderPayload(item);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (isForbiddenPayloadKey(key)) {
      throw new Error(`Snapshot contains raw provider payload field: ${key}.`);
    }

    assertNoRawProviderPayload(nestedValue);
  }
}

function isForbiddenPayloadKey(key: string): boolean {
  const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();

  return (
    normalizedKey === "raw" ||
    normalizedKey === "rawpayload" ||
    normalizedKey === "rawresponse" ||
    normalizedKey === "providerpayload" ||
    normalizedKey === "providerresponse" ||
    normalizedKey === "billingprofile"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
