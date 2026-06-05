import { describe, expect, it } from "vitest";
import type { DashboardSnapshot } from "./dashboard-data";
import { buildOperationsDashboard, resolveDashboardTimezone } from "./operations-data";

const BASE_DASHBOARD: DashboardSnapshot = {
  generatedAt: "2026-06-05T03:00:00.000Z",
  source: "sqlite",
  database: {
    available: true,
    reason: "ok",
  },
  summary: {
    providerCount: 1,
    totalEstimatedAmountMinor: 2000,
    totalBillingAmountMinor: 1100,
    currency: "USD",
    usageSnapshotCount: 1,
    costEstimateCount: 1,
    alertCount: 0,
    criticalAlertCount: 0,
    healthStatus: "ok",
  },
  providers: [
    {
      providerKey: "aws",
      displayName: "AWS Cost Explorer",
      estimatedAmountMinor: 2000,
      billingAmountMinor: 1100,
      currency: "USD",
      usageSnapshotCount: 1,
      billingSnapshotCount: 1,
      costEstimateCount: 1,
      healthStatus: "ok",
      alertCount: 0,
      riskLevel: "low",
      latestCollectedAt: "2026-06-04T15:00:00.000Z",
    },
  ],
  usage: {
    snapshotCount: 1,
    topMetrics: [],
  },
  risks: [],
  health: [],
  alerts: [],
};

describe("operations dashboard data", () => {
  it("separates canonical and live freshness without exposing secret values", () => {
    const dashboard = buildOperationsDashboard(BASE_DASHBOARD, {
      env: {
        AWS_PROFILE: "fake-profile",
      },
      now: new Date("2026-06-05T03:00:00.000Z"),
      timezone: "Asia/Seoul",
    });

    expect(dashboard.summary.monthForecastAmountMinor).toBe(2000);
    expect(dashboard.summary.confirmedThroughYesterdayAmountMinor).toBe(1100);
    expect(dashboard.summary.todayLiveAmountMinor).toBeNull();
    expect(dashboard.providers.find((provider) => provider.providerKey === "aws")).toMatchObject({
      connectionState: "env_configured",
      canonicalFreshness: "fresh",
      liveFreshness: "stale",
      liveGranularity: "current_period",
      todayLiveIncluded: false,
    });
    expect(JSON.stringify(dashboard)).not.toContain("fake-profile");
  });

  it("falls back when an invalid dashboard timezone is configured", () => {
    expect(resolveDashboardTimezone({ STACKSPEND_TIMEZONE: "Not/AZone" })).toBeTruthy();
  });
});
