import { describe, expect, it } from "vitest";
import { collectProviderSnapshots } from "./collector.js";
import type { ProviderConnector } from "./provider.js";

const fixedCollectedAt = "2026-06-02T00:00:00.000Z";

describe("collectProviderSnapshots", () => {
  it("collects normalized snapshots from read-only providers", async () => {
    const provider: ProviderConnector = {
      kind: "mock",
      displayName: "Mock Provider",
      access: "read-only",
      async collect() {
        return {
          collectedAt: fixedCollectedAt,
          status: "ok",
          snapshots: {
            usage: [
              {
                provider: "mock",
                collectedAt: fixedCollectedAt,
                metric: "requests",
                unit: "count",
                value: 12,
              },
            ],
            billing: [],
            serviceHealth: [],
            costEstimates: [],
          },
          alerts: [],
        };
      },
    };

    const result = await collectProviderSnapshots(provider);

    expect(result.provider).toBe("mock");
    expect(result.status).toBe("ok");
    expect(result.snapshots.usage).toHaveLength(1);
    expect(result.snapshots.usage[0]?.metric).toBe("requests");
  });

  it("rejects providers that are not explicitly read-only", async () => {
    const provider = {
      kind: "mock",
      displayName: "Unsafe Provider",
      access: "write",
      async collect() {
        return {
          collectedAt: fixedCollectedAt,
          status: "ok",
          snapshots: {
            usage: [],
            billing: [],
            serviceHealth: [],
            costEstimates: [],
          },
          alerts: [],
        };
      },
    } as unknown as ProviderConnector;

    await expect(collectProviderSnapshots(provider)).rejects.toThrow(/read-only/i);
  });

  it("rejects snapshots containing raw provider payload fields", async () => {
    const provider: ProviderConnector = {
      kind: "mock",
      displayName: "Leaky Provider",
      access: "read-only",
      async collect() {
        return {
          collectedAt: fixedCollectedAt,
          status: "ok",
          snapshots: {
            usage: [
              {
                provider: "mock",
                collectedAt: fixedCollectedAt,
                metric: "requests",
                unit: "count",
                value: 12,
                rawPayload: {
                  accountId: "FAKE_ACCOUNT_ID_123",
                },
              },
            ],
            billing: [],
            serviceHealth: [],
            costEstimates: [],
          },
          alerts: [],
        };
      },
    };

    await expect(collectProviderSnapshots(provider)).rejects.toThrow(/raw provider payload/i);
  });
});
