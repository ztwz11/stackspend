import { describe, expect, it } from "vitest";
import {
  buildNotificationDigest,
  buildOperationsOverview,
  buildTodayLiveView,
  buildTrayMenuModel,
  readOperationsOverview,
  type ViewModelStore,
} from "./index.js";

const NOW = new Date("2026-06-09T03:00:00.000Z");

const STORE_WITH_SENSITIVE_VALUES: ViewModelStore = {
  providers: [
    {
      key: "openai",
      displayName: "OpenAI acct_123456",
    },
  ],
  usageSnapshots: [
    {
      providerKey: "openai",
      collectedAt: NOW.toISOString(),
      service: "api",
      metric: "model_requests",
      unit: "requests",
      value: 42,
    },
  ],
  billingSnapshots: [
    {
      providerKey: "openai",
      collectedAt: NOW.toISOString(),
      amountMinor: 1200,
      currency: "USD",
      status: "estimated",
    },
  ],
  serviceHealthSnapshots: [
    {
      providerKey: "openai",
      collectedAt: NOW.toISOString(),
      service: "api",
      status: "ok",
    },
  ],
  costEstimates: [
    {
      providerKey: "openai",
      collectedAt: NOW.toISOString(),
      estimatedAmountMinor: 3456,
      currency: "USD",
      confidence: "medium",
    },
  ],
  alerts: [
    {
      providerKey: "openai",
      createdAt: NOW.toISOString(),
      severity: "warning",
      category: "billing",
      title: "Invoice invoice_test123 changed",
      message: "Contact dev@example.com with sk-test_123 or https://hooks.slack.com/services/T000/B000/SECRET",
    },
  ],
};

describe("shared view model", () => {
  it("returns local-safe operation responses without secrets or raw payloads", async () => {
    const overview = await readOperationsOverview({
      now: () => NOW,
      store: STORE_WITH_SENSITIVE_VALUES,
    });
    const serialized = JSON.stringify(overview);

    expect(overview.localOnly).toBe(true);
    expect(overview.secretsReturned).toBe(false);
    expect(overview.summary.totalEstimatedAmountMinor).toBe(3456);
    expect(serialized).not.toContain("acct_123456");
    expect(serialized).not.toContain("invoice_test123");
    expect(serialized).not.toContain("dev@example.com");
    expect(serialized).not.toContain("sk-test_123");
    expect(serialized).not.toContain("hooks.slack.com");
    expect(serialized.toLowerCase()).not.toContain("rawpayload");
  });

  it("builds digest and tray models from the same secret-safe envelopes", () => {
    const overview = buildOperationsOverview(STORE_WITH_SENSITIVE_VALUES, {
      generatedAt: NOW.toISOString(),
    });
    const todayLive = buildTodayLiveView(STORE_WITH_SENSITIVE_VALUES, {
      generatedAt: NOW.toISOString(),
      now: NOW,
      timezone: "UTC",
    });
    const digest = buildNotificationDigest(overview, todayLive);
    const tray = buildTrayMenuModel(digest);

    expect(digest.secretsReturned).toBe(false);
    expect(tray.secretsReturned).toBe(false);
    expect(digest.items.map((item) => item.kind)).toEqual(["summary", "live", "risk"]);
    expect(tray.items.map((item) => item.id)).toEqual([
      "status",
      "open-dashboard",
      "refresh-now",
      "separator-main",
      "quit",
    ]);
    expect(JSON.stringify({ digest, tray })).not.toContain("dev@example.com");
  });
});
