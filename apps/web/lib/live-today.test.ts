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
      usageSummary: {
        kind: "llm_subscription",
        period: "current_month",
        metrics: [
          { key: "input_tokens", value: 1200, unit: "tokens" },
          { key: "output_tokens", value: 300, unit: "tokens" },
          { key: "model_requests", value: 7, unit: "requests" },
        ],
        topServices: ["completions:gpt-5-mini"],
      },
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
      usageSummary: {
        kind: "llm_subscription",
        metrics: [
          { key: "input_tokens", value: 1200, unit: "tokens" },
          { key: "output_tokens", value: 300, unit: "tokens" },
          { key: "model_requests", value: 7, unit: "requests" },
        ],
      },
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
      usageSummary: {
        kind: "llm_subscription",
      },
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

  it("keeps separate live cache entries for multiple provider connections", async () => {
    const store = createMemoryCredentialStore({
      now: () => NOW,
    });
    await store.setCredential("openai", "read-only", {
      connectionId: "conn_personal",
      label: "Personal",
      secret: "FAKE_OPENAI_PERSONAL_ADMIN_KEY",
      authMethod: "api_key",
    });
    await store.setCredential("openai", "read-only", {
      connectionId: "conn_work",
      label: "Work",
      secret: "FAKE_OPENAI_WORK_ADMIN_KEY",
      authMethod: "api_key",
    });
    const connections = await readConnectionsStatus({
      credentialStore: store,
      now: () => NOW,
    });
    const seenConnectionIds: string[] = [];

    const snapshot = await refreshLiveToday({
      connections,
      credentialStore: store,
      now: () => NOW,
      collectors: {
        openai: async (context) => {
          const connectionId = context.credentialConnection?.connectionId ?? "missing";
          seenConnectionIds.push(connectionId);

          return {
            providerKey: "openai",
            connectionId,
            ...(context.credentialConnection?.label === undefined
              ? {}
              : { connectionLabel: context.credentialConnection.label }),
            status: "ok",
            checkedAt: NOW.toISOString(),
            todayLiveAmountMinor: connectionId === "conn_work" ? 200 : 100,
            currency: "USD",
            included: true,
            confidence: "medium",
          };
        },
      },
    });
    const openAiSnapshots = snapshot.providers.filter((provider) => provider.providerKey === "openai");

    expect(seenConnectionIds.sort()).toEqual(["conn_personal", "conn_work"]);
    expect(openAiSnapshots).toEqual([
      expect.objectContaining({
        connectionId: "conn_personal",
        connectionLabel: "Personal",
        todayLiveAmountMinor: 100,
      }),
      expect.objectContaining({
        connectionId: "conn_work",
        connectionLabel: "Work",
        todayLiveAmountMinor: 200,
      }),
    ]);
  });
});
