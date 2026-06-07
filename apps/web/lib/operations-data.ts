import { loadStackSpendConfig } from "../../../packages/config/src/index";
import {
  readConnectionsStatus,
  type ConnectionState,
  type ConnectionsStatusPayload,
  type EmergencyAccessState,
  type ProviderConnectionStatus,
} from "./connection-status";
import type {
  DashboardAlertItem,
  DashboardHealthStatus,
  DashboardProviderRow,
  DashboardRiskLevel,
  DashboardRiskSeverity,
  DashboardSnapshot,
} from "./dashboard-data";
import { readDashboardSnapshot, type ReadDashboardSnapshotOptions } from "./dashboard-data";
import {
  AVAILABLE_PROVIDER_KEYS,
  findAvailableProvider,
  type LiveGranularity,
  type ProviderKey,
} from "./provider-catalog";
import {
  readLiveTodaySnapshot,
  type LiveTodaySnapshot,
} from "./live-today";

export type CanonicalFreshness = "fresh" | "stale" | "missing";
export type LiveFreshness = "live" | "stale" | "error" | "unavailable" | "not_configured" | "locked";

export interface OperationsDashboard {
  generatedAt: string;
  source: DashboardSnapshot["source"];
  database: DashboardSnapshot["database"];
  timezone: string;
  summary: OperationsSummary;
  providers: OperationsProvider[];
  risks: DashboardAlertItem[];
}

export interface OperationsSummary {
  currency: string;
  monthForecastAmountMinor: number;
  confirmedThroughYesterdayAmountMinor: number;
  todayLiveAmountMinor: number | null;
  todayLiveIncludedProviderCount: number;
  todayLiveExcludedProviderCount: number;
  providersNeedingAttention: number;
  canonicalCoverageDate: string | null;
  remainingDaysInMonth: number;
}

export interface OperationsProvider {
  providerKey: ProviderKey;
  displayName: string;
  connectionState: ConnectionState;
  credentialSource: ProviderConnectionStatus["credentialSource"];
  readOnlyTestState: ConnectionState;
  emergencyAccessState: EmergencyAccessState;
  authMethod: string;
  credentialRequirements: readonly string[];
  requiredEnvKeys: readonly string[];
  configuredEnvKeys: readonly string[];
  missingEnvKeys: readonly string[];
  canonicalFreshness: CanonicalFreshness;
  liveFreshness: LiveFreshness;
  liveGranularity: LiveGranularity;
  liveConfidence: "high" | "medium" | "low" | "none";
  latestCanonicalSync: string | null;
  latestLiveCheck: string | null;
  monthForecastAmountMinor: number;
  confirmedAmountMinor: number;
  todayLiveAmountMinor: number | null;
  todayLiveIncluded: boolean;
  currency: string;
  usageSnapshotCount: number;
  healthStatus: DashboardHealthStatus;
  riskLevel: DashboardRiskLevel;
  alertCount: number;
  risks: DashboardAlertItem[];
}

export interface ReadOperationsDashboardOptions extends ReadDashboardSnapshotOptions {
  env?: Record<string, string | undefined>;
  connections?: ConnectionsStatusPayload;
  liveToday?: LiveTodaySnapshot;
}

export async function readOperationsDashboard(
  options: ReadOperationsDashboardOptions = {},
): Promise<OperationsDashboard> {
  const snapshot = await readDashboardSnapshot(options);
  const env = options.env ?? process.env;
  const timezone = resolveDashboardTimezone(env);
  const now = options.now?.() ?? new Date();
  const connections = options.connections ?? await readConnectionsStatus({
    env,
    now: () => now,
  });
  const liveToday = options.liveToday ?? await readLiveTodaySnapshot({
    env,
    connections,
    now: () => now,
    timezone,
  });

  return buildOperationsDashboard(snapshot, {
    connections,
    env,
    liveToday,
    now,
    timezone,
  });
}

export function buildOperationsDashboard(
  snapshot: DashboardSnapshot,
  options: {
    connections?: ConnectionsStatusPayload;
    env: Record<string, string | undefined>;
    liveToday?: LiveTodaySnapshot;
    now: Date;
    timezone: string;
  },
): OperationsDashboard {
  const config = loadStackSpendConfig(options.env);
  const providers = AVAILABLE_PROVIDER_KEYS.map((providerKey) => {
    const catalog = findAvailableProvider(providerKey);
    const row = snapshot.providers.find((provider) => provider.providerKey === providerKey);
    const providerConfig = config.providers[providerKey];
    const connection = options.connections?.providers.find((item) => item.providerKey === providerKey);
    const live = options.liveToday?.providers.find((item) => item.providerKey === providerKey);
    const connectionState = connection?.connectionState ?? (providerConfig.configured ? "env_configured" : "not_configured");
    const canonicalFreshness = summarizeCanonicalFreshness(row, options.now, options.timezone);
    const liveFreshness = live?.freshness ?? summarizeLiveFreshness(connectionState, catalog?.liveGranularity ?? "unavailable");
    const risks = snapshot.alerts.filter((alert) => alert.providerKey === providerKey);

    return {
      providerKey,
      displayName: row?.displayName ?? catalog?.name ?? providerKey,
      connectionState,
      credentialSource: connection?.credentialSource ?? (connectionState === "env_configured" ? "env" : "none"),
      readOnlyTestState: connection?.readOnlyTestState ?? connectionState,
      emergencyAccessState: "emergency_planned",
      authMethod: connection?.authMethod ?? catalog?.authMethods.join(" / ") ?? "Unknown",
      credentialRequirements: connection?.credentialRequirements ?? [],
      requiredEnvKeys: connection?.requiredEnvKeys ?? providerConfig.requiredEnvKeys,
      configuredEnvKeys: connection?.configuredEnvKeys ?? providerConfig.configuredEnvKeys,
      missingEnvKeys: connection?.missingEnvKeys ?? providerConfig.missingEnvKeys,
      canonicalFreshness,
      liveFreshness,
      liveGranularity: catalog?.liveGranularity ?? "unavailable",
      liveConfidence: live?.confidence ?? "none",
      latestCanonicalSync: row?.latestCollectedAt ?? null,
      latestLiveCheck: live?.checkedAt ?? null,
      monthForecastAmountMinor: row?.estimatedAmountMinor ?? 0,
      confirmedAmountMinor: row?.billingAmountMinor ?? 0,
      todayLiveAmountMinor: live?.todayLiveAmountMinor ?? null,
      todayLiveIncluded: live?.included ?? false,
      currency: live?.currency ?? row?.currency ?? snapshot.summary.currency,
      usageSnapshotCount: row?.usageSnapshotCount ?? 0,
      healthStatus: row?.healthStatus ?? "unknown",
      riskLevel: row?.riskLevel ?? "warning",
      alertCount: row?.alertCount ?? 0,
      risks,
    } satisfies OperationsProvider;
  });
  const canonicalCoverageDate = latestDateKey(
    providers.map((provider) => provider.latestCanonicalSync).filter((value): value is string => value !== null),
    options.timezone,
  );
  const includedLiveProviders = providers.filter((provider) =>
    provider.todayLiveIncluded &&
    provider.todayLiveAmountMinor !== null &&
    provider.currency === snapshot.summary.currency
  );
  const todayLiveAmountMinor = sum(includedLiveProviders.map((provider) => provider.todayLiveAmountMinor ?? 0));
  const remainingDays = remainingDaysInMonth(options.now, options.timezone);
  const projectedRemainingDays = projectedRemainingAmountMinor(
    snapshot.summary.totalBillingAmountMinor,
    options.now,
    options.timezone,
    remainingDays,
  );
  const monthForecastAmountMinor =
    snapshot.summary.totalBillingAmountMinor + todayLiveAmountMinor + projectedRemainingDays;

  return {
    generatedAt: snapshot.generatedAt,
    source: snapshot.source,
    database: snapshot.database,
    timezone: options.timezone,
    summary: {
      currency: snapshot.summary.currency,
      monthForecastAmountMinor,
      confirmedThroughYesterdayAmountMinor: snapshot.summary.totalBillingAmountMinor,
      todayLiveAmountMinor: includedLiveProviders.length === 0 ? null : todayLiveAmountMinor,
      todayLiveIncludedProviderCount: includedLiveProviders.length,
      todayLiveExcludedProviderCount: providers.length - includedLiveProviders.length,
      providersNeedingAttention: providers.filter(providerNeedsAttention).length,
      canonicalCoverageDate,
      remainingDaysInMonth: remainingDays,
    },
    providers,
    risks: snapshot.alerts,
  };
}

export function resolveDashboardTimezone(env: Record<string, string | undefined> = process.env): string {
  const configured = env.STACKSPEND_TIMEZONE?.trim();

  if (configured !== undefined && configured.length > 0 && isValidTimeZone(configured)) {
    return configured;
  }

  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function summarizeCanonicalFreshness(
  row: DashboardProviderRow | undefined,
  now: Date,
  timezone: string,
): CanonicalFreshness {
  if (row?.latestCollectedAt === undefined || row.latestCollectedAt === null) {
    return "missing";
  }

  const latest = dateKeyInTimezone(new Date(row.latestCollectedAt), timezone);
  const yesterday = dateKeyInTimezone(new Date(now.getTime() - 24 * 60 * 60 * 1000), timezone);

  return latest >= yesterday ? "fresh" : "stale";
}

function summarizeLiveFreshness(connectionState: ConnectionState, liveGranularity: LiveGranularity): LiveFreshness {
  if (connectionState === "locked") {
    return "locked";
  }

  if (connectionState === "not_configured") {
    return "not_configured";
  }

  if (connectionState === "invalid" || connectionState === "expired") {
    return "error";
  }

  if (liveGranularity === "unavailable") {
    return "unavailable";
  }

  return "stale";
}

function providerNeedsAttention(provider: OperationsProvider): boolean {
  return (
    provider.canonicalFreshness !== "fresh"
    || provider.liveFreshness !== "live"
    || provider.riskLevel !== "low"
    || provider.healthStatus !== "ok"
  );
}

function latestDateKey(values: readonly string[], timezone: string): string | null {
  if (values.length === 0) {
    return null;
  }

  return values
    .map((value) => dateKeyInTimezone(new Date(value), timezone))
    .sort((first, second) => second.localeCompare(first))[0] ?? null;
}

function remainingDaysInMonth(now: Date, timezone: string): number {
  const parts = datePartsInTimezone(now, timezone);
  const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();

  return Math.max(lastDay - parts.day, 0);
}

function projectedRemainingAmountMinor(
  confirmedThroughYesterdayAmountMinor: number,
  now: Date,
  timezone: string,
  remainingDays: number,
): number {
  if (confirmedThroughYesterdayAmountMinor <= 0 || remainingDays <= 0) {
    return 0;
  }

  const completedCanonicalDays = Math.max(datePartsInTimezone(now, timezone).day - 1, 1);

  return Math.round((confirmedThroughYesterdayAmountMinor / completedCanonicalDays) * remainingDays);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function dateKeyInTimezone(date: Date, timezone: string): string {
  const parts = datePartsInTimezone(date, timezone);

  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function datePartsInTimezone(date: Date, timezone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? "1970"),
    month: Number(parts.find((part) => part.type === "month")?.value ?? "01"),
    day: Number(parts.find((part) => part.type === "day")?.value ?? "01"),
  };
}

function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
