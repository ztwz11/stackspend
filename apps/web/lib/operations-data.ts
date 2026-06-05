import { loadStackSpendConfig } from "../../../packages/config/src/index";
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

export type CanonicalFreshness = "fresh" | "stale" | "missing";
export type LiveFreshness = "live" | "stale" | "error" | "unavailable" | "not_configured" | "locked";
export type ConnectionState =
  | "not_configured"
  | "env_configured"
  | "credential_store_configured"
  | "oauth_connected"
  | "locked"
  | "expired"
  | "invalid"
  | "read_only_ready";
export type EmergencyAccessState = "emergency_not_configured" | "emergency_planned";

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
  emergencyAccessState: EmergencyAccessState;
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
}

export async function readOperationsDashboard(
  options: ReadOperationsDashboardOptions = {},
): Promise<OperationsDashboard> {
  const snapshot = await readDashboardSnapshot(options);
  const env = options.env ?? process.env;
  const timezone = resolveDashboardTimezone(env);
  const now = options.now?.() ?? new Date();

  return buildOperationsDashboard(snapshot, {
    env,
    now,
    timezone,
  });
}

export function buildOperationsDashboard(
  snapshot: DashboardSnapshot,
  options: {
    env: Record<string, string | undefined>;
    now: Date;
    timezone: string;
  },
): OperationsDashboard {
  const config = loadStackSpendConfig(options.env);
  const providers = AVAILABLE_PROVIDER_KEYS.map((providerKey) => {
    const catalog = findAvailableProvider(providerKey);
    const row = snapshot.providers.find((provider) => provider.providerKey === providerKey);
    const providerConfig = config.providers[providerKey];
    const connectionState = providerConfig.configured ? "env_configured" : "not_configured";
    const canonicalFreshness = summarizeCanonicalFreshness(row, options.now, options.timezone);
    const liveFreshness = summarizeLiveFreshness(providerConfig.configured, catalog?.liveGranularity ?? "unavailable");
    const risks = snapshot.alerts.filter((alert) => alert.providerKey === providerKey);

    return {
      providerKey,
      displayName: row?.displayName ?? catalog?.name ?? providerKey,
      connectionState,
      emergencyAccessState: "emergency_planned",
      requiredEnvKeys: providerConfig.requiredEnvKeys,
      configuredEnvKeys: providerConfig.configuredEnvKeys,
      missingEnvKeys: providerConfig.missingEnvKeys,
      canonicalFreshness,
      liveFreshness,
      liveGranularity: catalog?.liveGranularity ?? "unavailable",
      liveConfidence: "none",
      latestCanonicalSync: row?.latestCollectedAt ?? null,
      latestLiveCheck: null,
      monthForecastAmountMinor: row?.estimatedAmountMinor ?? 0,
      confirmedAmountMinor: row?.billingAmountMinor ?? 0,
      todayLiveAmountMinor: null,
      todayLiveIncluded: false,
      currency: row?.currency ?? snapshot.summary.currency,
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

  return {
    generatedAt: snapshot.generatedAt,
    source: snapshot.source,
    database: snapshot.database,
    timezone: options.timezone,
    summary: {
      currency: snapshot.summary.currency,
      monthForecastAmountMinor: snapshot.summary.totalEstimatedAmountMinor,
      confirmedThroughYesterdayAmountMinor: snapshot.summary.totalBillingAmountMinor,
      todayLiveAmountMinor: null,
      todayLiveIncludedProviderCount: providers.filter((provider) => provider.todayLiveIncluded).length,
      todayLiveExcludedProviderCount: providers.filter((provider) => !provider.todayLiveIncluded).length,
      providersNeedingAttention: providers.filter(providerNeedsAttention).length,
      canonicalCoverageDate,
      remainingDaysInMonth: remainingDaysInMonth(options.now, options.timezone),
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

function summarizeLiveFreshness(configured: boolean, liveGranularity: LiveGranularity): LiveFreshness {
  if (!configured) {
    return "not_configured";
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
