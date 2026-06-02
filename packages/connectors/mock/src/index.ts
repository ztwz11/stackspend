export type MockProviderSnapshot = {
  provider: "mock";
  collectedAt: string;
  status: "ok";
};

export interface MockProviderCollectionContext {
  now(): Date;
}

export interface MockProviderConnector {
  kind: "mock";
  displayName: "Mock Provider";
  access: "read-only";
  collect(context: MockProviderCollectionContext): Promise<MockProviderCollectionResult>;
}

export interface MockProviderCollectionResult {
  collectedAt: string;
  status: "ok";
  snapshots: {
    usage: readonly MockUsageSnapshot[];
    billing: readonly MockBillingSnapshot[];
    serviceHealth: readonly MockServiceHealthSnapshot[];
    costEstimates: readonly MockCostEstimate[];
  };
  alerts: readonly [];
}

export interface MockSnapshotBase {
  provider: "mock";
  collectedAt: string;
  service?: string;
}

export interface MockUsageSnapshot extends MockSnapshotBase {
  service: "mock-api";
  metric: "requests";
  unit: "count";
  value: 1200;
}

export interface MockBillingSnapshot extends MockSnapshotBase {
  periodStart: string;
  periodEnd: string;
  amountMinor: 1234;
  currency: "USD";
  status: "estimated";
}

export interface MockServiceHealthSnapshot extends MockSnapshotBase {
  service: "mock-api";
  region: "local";
  status: "ok";
}

export interface MockCostEstimate extends MockSnapshotBase {
  periodStart: string;
  periodEnd: string;
  estimatedAmountMinor: 1500;
  currency: "USD";
  confidence: "high";
}

export function createMockSnapshot(collectedAt = new Date().toISOString()): MockProviderSnapshot {
  return {
    provider: "mock",
    collectedAt,
    status: "ok",
  };
}

export function createMockProviderConnector(): MockProviderConnector {
  return {
    kind: "mock",
    displayName: "Mock Provider",
    access: "read-only",
    async collect(context) {
      const collectedAt = context.now().toISOString();

      return {
        collectedAt,
        status: "ok",
        snapshots: {
          usage: [
            {
              provider: "mock",
              collectedAt,
              service: "mock-api",
              metric: "requests",
              unit: "count",
              value: 1200,
            },
          ],
          billing: [
            {
              provider: "mock",
              collectedAt,
              periodStart: "2026-06-01",
              periodEnd: "2026-06-30",
              amountMinor: 1234,
              currency: "USD",
              status: "estimated",
            },
          ],
          serviceHealth: [
            {
              provider: "mock",
              collectedAt,
              service: "mock-api",
              region: "local",
              status: "ok",
            },
          ],
          costEstimates: [
            {
              provider: "mock",
              collectedAt,
              periodStart: "2026-06-01",
              periodEnd: "2026-06-30",
              estimatedAmountMinor: 1500,
              currency: "USD",
              confidence: "high",
            },
          ],
        },
        alerts: [],
      };
    },
  };
}
