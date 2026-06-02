import { describe, expect, it } from "vitest";
import { createMockProviderConnector } from "./index.js";

const FIXED_NOW = "2026-06-02T09:00:00.000Z";

describe("createMockProviderConnector", () => {
  it("returns a read-only mock connector with normalized snapshots", async () => {
    const connector = createMockProviderConnector();
    const result = await connector.collect({
      now: () => new Date(FIXED_NOW),
    });

    expect(connector.kind).toBe("mock");
    expect(connector.access).toBe("read-only");
    expect(result).toMatchObject({
      collectedAt: FIXED_NOW,
      status: "ok",
      snapshots: {
        usage: [
          {
            provider: "mock",
            collectedAt: FIXED_NOW,
            service: "mock-api",
            metric: "requests",
            unit: "count",
            value: 1200,
          },
        ],
        billing: [
          {
            provider: "mock",
            collectedAt: FIXED_NOW,
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
            collectedAt: FIXED_NOW,
            service: "mock-api",
            region: "local",
            status: "ok",
          },
        ],
        costEstimates: [
          {
            provider: "mock",
            collectedAt: FIXED_NOW,
            periodStart: "2026-06-01",
            periodEnd: "2026-06-30",
            estimatedAmountMinor: 1500,
            currency: "USD",
            confidence: "high",
          },
        ],
      },
      alerts: [],
    });
  });

  it("does not expose raw provider payloads or sensitive identifiers", async () => {
    const connector = createMockProviderConnector();
    const result = await connector.collect({
      now: () => new Date(FIXED_NOW),
    });

    expect(JSON.stringify(result)).not.toMatch(
      /rawPayload|rawResponse|providerPayload|billingProfile|acct_|project_|invoice_|sk-|hooks\.slack|@/i,
    );
  });
});
