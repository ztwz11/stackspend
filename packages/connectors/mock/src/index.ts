export type MockProviderSnapshot = {
  provider: "mock";
  collectedAt: string;
  status: "ok";
};

export function createMockSnapshot(collectedAt = new Date().toISOString()): MockProviderSnapshot {
  return {
    provider: "mock",
    collectedAt,
    status: "ok",
  };
}
