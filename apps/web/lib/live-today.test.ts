import { describe, expect, it, beforeEach } from "vitest";
import { createMemoryCredentialStore } from "../../../packages/credentials/src/index";
import { readConnectionsStatus } from "./connection-status";
import {
  clearLiveTodayCache,
  readLiveTodaySnapshot,
  refreshLiveToday,
  type LiveTodayProviderCollector,
} from "./live-today";

const NOW = new Date("2026-06-08T04:00:00.000Z");

beforeEach(() => {
  clearLiveTodayCache();
});

describe("live today cache", () => {
  it("keeps live provider values in a short-lived provisional cache", async () => {
    const store = createMemoryCredentialStore({
      now: () => NOW,
    });
    await store.setCredential("openai", "read-only", {
      secret: "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
      authMethod: "api_key",
    });
    const connections = await readConnectionsStatus({
      credentialStore: store,
      now: () => NOW,
    });
    const openAiCollector: LiveTodayProviderCollector = async () => ({
      providerKey: "openai",
      status: "ok",
      checkedAt: NOW.toISOString(),
      todayLiveAmountMinor: 1234,
      currency: "USD",
      included: true,
      confidence: "medium",
    });

    const refreshed = await refreshLiveToday({
      connections,
      credentialStore: store,
      now: () => NOW,
      ttlSeconds: 60,
      collectors: {
        openai: openAiCollector,
      },
    });

    expect(refreshed.providers.find((provider) => provider.providerKey === "openai")).toMatchObject({
      freshness: "live",
      provisional: true,
      todayLiveAmountMinor: 1234,
      included: true,
    });
    expect(JSON.stringify(refreshed)).not.toContain("FAKE_OPENAI_ADMIN_KEY_FOR_TESTS");

    const stale = await readLiveTodaySnapshot({
      connections,
      credentialStore: store,
      now: () => new Date("2026-06-08T04:02:00.000Z"),
      ttlSeconds: 60,
    });

    expect(stale.providers.find((provider) => provider.providerKey === "openai")).toMatchObject({
      freshness: "stale",
      included: false,
      todayLiveAmountMinor: 1234,
    });
  });

  it("does not run collectors for unconfigured providers", async () => {
    const connections = await readConnectionsStatus({
      credentialStore: createMemoryCredentialStore({
        now: () => NOW,
      }),
      now: () => NOW,
    });
    let called = false;

    const snapshot = await refreshLiveToday({
      connections,
      now: () => NOW,
      collectors: {
        openai: async () => {
          called = true;
          throw new Error("should not run");
        },
      },
    });

    expect(called).toBe(false);
    expect(snapshot.providers.find((provider) => provider.providerKey === "openai")).toMatchObject({
      freshness: "not_configured",
      included: false,
      status: "partial",
    });
  });
});
