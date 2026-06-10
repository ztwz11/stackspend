import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  type NotificationWidgetKey,
} from "./notification-preferences.js";

export interface LocalSafeEnvelope {
  generatedAt: string;
  localOnly: true;
  secretsReturned: false;
}

export type ViewModelHealthStatus = "ok" | "degraded" | "down" | "unknown";
export type ViewModelRiskSeverity = "info" | "warning" | "critical";

export interface ViewModelProviderRecord {
  key: string;
  displayName: string;
}

export interface ViewModelUsageSnapshotRecord {
  providerKey: string;
  collectedAt: string;
  service: string;
  metric: string;
  unit: string;
  value: number;
}

export interface ViewModelBillingSnapshotRecord {
  providerKey: string;
  collectedAt: string;
  amountMinor: number;
  currency: string;
  status: string;
}

export interface ViewModelServiceHealthSnapshotRecord {
  providerKey: string;
  collectedAt: string;
  service: string;
  status: ViewModelHealthStatus;
  region?: string;
  message?: string;
}

export interface ViewModelCostEstimateRecord {
  providerKey: string;
  collectedAt: string;
  estimatedAmountMinor: number;
  currency: string;
  confidence: "low" | "medium" | "high";
}

export interface ViewModelAlertRecord {
  providerKey?: string;
  createdAt: string;
  severity: ViewModelRiskSeverity;
  category: string;
  title: string;
  message: string;
}

export interface ViewModelStore {
  providers: readonly ViewModelProviderRecord[];
  usageSnapshots: readonly ViewModelUsageSnapshotRecord[];
  billingSnapshots: readonly ViewModelBillingSnapshotRecord[];
  serviceHealthSnapshots: readonly ViewModelServiceHealthSnapshotRecord[];
  costEstimates: readonly ViewModelCostEstimateRecord[];
  alerts: readonly ViewModelAlertRecord[];
}

export type ViewModelReadStore = () => Promise<ViewModelStore>;

export interface OperationsOverview extends LocalSafeEnvelope {
  source: "sqlite" | "empty";
  summary: {
    providerCount: number;
    connectedProviderCount: number;
    totalEstimatedAmountMinor: number;
    totalBillingAmountMinor: number;
    currency: string;
    usageSnapshotCount: number;
    costEstimateCount: number;
    alertCount: number;
    criticalAlertCount: number;
    healthStatus: ViewModelHealthStatus;
  };
  providers: readonly OperationsOverviewProvider[];
  alerts: readonly OperationsOverviewAlert[];
}

export interface OperationsOverviewProvider {
  providerKey: string;
  displayName: string;
  estimatedAmountMinor: number;
  billingAmountMinor: number;
  currency: string;
  usageSnapshotCount: number;
  costEstimateCount: number;
  latestCollectedAt: string | null;
  healthStatus: ViewModelHealthStatus;
  riskLevel: "low" | "warning" | "critical";
  alertCount: number;
}

export interface OperationsOverviewAlert {
  providerKey: string | null;
  displayName: string | null;
  severity: ViewModelRiskSeverity;
  category: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface TodayLiveView extends LocalSafeEnvelope {
  timezone: string;
  dateKey: string;
  cacheState: "empty" | "fresh" | "stale";
  summary: {
    providerCount: number;
    includedProviderCount: number;
    todayLiveAmountMinor: number | null;
    currency: string;
  };
  providers: readonly TodayLiveProviderView[];
}

export interface TodayLiveProviderInput {
  providerKey: string;
  displayName: string;
  checkedAt: string | null;
  freshness: "live" | "stale" | "error" | "unavailable" | "not_configured" | "locked";
  confidence: "high" | "medium" | "low" | "none";
  todayLiveAmountMinor: number | null;
  currency: string;
  included: boolean;
  metrics?: readonly TodayLiveMetric[];
}

export interface TodayLiveProviderView extends TodayLiveProviderInput {
  metrics: readonly TodayLiveMetric[];
}

export interface TodayLiveMetric {
  key: string;
  value: number;
  unit: string;
}

export interface NotificationDigest extends LocalSafeEnvelope {
  title: string;
  status: "ok" | "attention" | "critical";
  suppressedReason: string | null;
  items: readonly NotificationDigestItem[];
}

export interface NotificationDigestItem {
  widgetKey: NotificationWidgetKey;
  kind: "summary" | "live" | "risk";
  severity: ViewModelRiskSeverity;
  label: string;
  value: string;
}

export interface TrayMenuModel extends LocalSafeEnvelope {
  title: string;
  subtitle: string;
  status: "ok" | "attention" | "critical";
  items: readonly TrayMenuItem[];
}

export interface TrayMenuItem {
  id: string;
  label: string;
  enabled: boolean;
  kind: "command" | "separator" | "status";
}

export interface ReadOperationsOverviewOptions {
  now?: () => Date;
  store?: ViewModelStore;
  readStore?: ViewModelReadStore;
}

export interface ReadTodayLiveViewOptions extends ReadOperationsOverviewOptions {
  timezone?: string;
  liveProviders?: readonly TodayLiveProviderInput[];
}

export interface ReadNotificationDigestOptions extends ReadTodayLiveViewOptions {
  overview?: OperationsOverview;
  todayLive?: TodayLiveView;
  notificationPreferences?: NotificationPreferences;
}

export interface ReadTrayMenuModelOptions extends ReadNotificationDigestOptions {
  digest?: NotificationDigest;
}

const DEFAULT_CURRENCY = "USD";
const SENSITIVE_TEXT_PATTERN =
  /(https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+|\b(?:sk|sbp|xox[baprs])[-_][A-Za-z0-9_-]+\b|\bacct[_-][A-Za-z0-9_-]+\b|\b(?:proj|project)[_-][A-Za-z0-9_-]+\b|\b(?:in|invoice)[_-][A-Za-z0-9_-]+\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

const EMPTY_STORE: ViewModelStore = {
  providers: [],
  usageSnapshots: [],
  billingSnapshots: [],
  serviceHealthSnapshots: [],
  costEstimates: [],
  alerts: [],
};

export async function readOperationsOverview(
  options: ReadOperationsOverviewOptions = {},
): Promise<OperationsOverview> {
  const store = await resolveStore(options);
  const now = options.now?.() ?? new Date();

  return buildOperationsOverview(store, {
    generatedAt: now.toISOString(),
  });
}

export function buildOperationsOverview(
  store: ViewModelStore,
  options: {
    generatedAt: string;
  },
): OperationsOverview {
  const providerNames = new Map(
    store.providers.map((provider) => [provider.key, safeText(provider.displayName)]),
  );
  const providers = store.providers.map((provider): OperationsOverviewProvider => {
    const providerKey = safeText(provider.key);
    const billingSnapshots = store.billingSnapshots.filter((snapshot) => snapshot.providerKey === provider.key);
    const costEstimates = store.costEstimates.filter((estimate) => estimate.providerKey === provider.key);
    const usageSnapshots = store.usageSnapshots.filter((snapshot) => snapshot.providerKey === provider.key);
    const healthSnapshots = store.serviceHealthSnapshots.filter((snapshot) => snapshot.providerKey === provider.key);
    const alerts = store.alerts.filter((alert) => alert.providerKey === provider.key);
    const healthStatus = summarizeHealth(healthSnapshots.map((snapshot) => snapshot.status));

    return {
      providerKey,
      displayName: safeText(provider.displayName),
      estimatedAmountMinor: sum(costEstimates.map((estimate) => estimate.estimatedAmountMinor)),
      billingAmountMinor: sum(billingSnapshots.map((snapshot) => snapshot.amountMinor)),
      currency: summarizeCurrency([
        ...costEstimates.map((estimate) => estimate.currency),
        ...billingSnapshots.map((snapshot) => snapshot.currency),
      ]),
      usageSnapshotCount: usageSnapshots.length,
      costEstimateCount: costEstimates.length,
      latestCollectedAt: latestIso([
        ...billingSnapshots.map((snapshot) => snapshot.collectedAt),
        ...costEstimates.map((estimate) => estimate.collectedAt),
        ...usageSnapshots.map((snapshot) => snapshot.collectedAt),
        ...healthSnapshots.map((snapshot) => snapshot.collectedAt),
      ]),
      healthStatus,
      riskLevel: summarizeRisk(alerts.map((alert) => alert.severity), healthStatus),
      alertCount: alerts.length,
    };
  });
  const alerts = store.alerts
    .map((alert): OperationsOverviewAlert => {
      const providerKey = alert.providerKey === undefined ? null : safeText(alert.providerKey);

      return {
        providerKey,
        displayName: alert.providerKey === undefined
          ? null
          : providerNames.get(alert.providerKey) ?? safeText(alert.providerKey),
        severity: alert.severity,
        category: safeText(alert.category),
        title: safeText(alert.title),
        message: safeText(alert.message),
        createdAt: alert.createdAt,
      };
    })
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, 5);
  const summaryCurrency = summarizeCurrency([
    ...store.costEstimates.map((estimate) => estimate.currency),
    ...store.billingSnapshots.map((snapshot) => snapshot.currency),
  ]);

  return {
    generatedAt: options.generatedAt,
    localOnly: true,
    secretsReturned: false,
    source: store.providers.length === 0 ? "empty" : "sqlite",
    summary: {
      providerCount: store.providers.length,
      connectedProviderCount: providers.filter((provider) => provider.latestCollectedAt !== null).length,
      totalEstimatedAmountMinor: sum(store.costEstimates.map((estimate) => estimate.estimatedAmountMinor)),
      totalBillingAmountMinor: sum(store.billingSnapshots.map((snapshot) => snapshot.amountMinor)),
      currency: summaryCurrency,
      usageSnapshotCount: store.usageSnapshots.length,
      costEstimateCount: store.costEstimates.length,
      alertCount: store.alerts.length,
      criticalAlertCount: store.alerts.filter((alert) => alert.severity === "critical").length,
      healthStatus: summarizeHealth(providers.map((provider) => provider.healthStatus)),
    },
    providers,
    alerts,
  };
}

export async function readTodayLiveView(options: ReadTodayLiveViewOptions = {}): Promise<TodayLiveView> {
  const now = options.now?.() ?? new Date();
  const store = await resolveStore(options);
  const buildOptions = {
    generatedAt: now.toISOString(),
    now,
    timezone: options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
    ...(options.liveProviders === undefined ? {} : { liveProviders: options.liveProviders }),
  };

  return buildTodayLiveView(store, buildOptions);
}

export function buildTodayLiveView(
  store: ViewModelStore,
  options: {
    generatedAt: string;
    now: Date;
    timezone: string;
    liveProviders?: readonly TodayLiveProviderInput[];
  },
): TodayLiveView {
  const dateKey = dateKeyInTimezone(options.now, options.timezone);
  const providers = options.liveProviders === undefined
    ? todayProvidersFromStore(store, dateKey)
    : options.liveProviders.map((provider) => ({
        ...provider,
        providerKey: safeText(provider.providerKey),
        displayName: safeText(provider.displayName),
        metrics: (provider.metrics ?? []).map((metric) => ({
          key: safeText(metric.key),
          value: metric.value,
          unit: safeText(metric.unit),
        })),
      }));
  const includedProviders = providers.filter((provider) =>
    provider.included && provider.todayLiveAmountMinor !== null
  );
  const currency = singleCurrency(includedProviders.map((provider) => provider.currency)) ?? DEFAULT_CURRENCY;
  const canSum = includedProviders.length > 0 && includedProviders.every((provider) => provider.currency === currency);

  return {
    generatedAt: options.generatedAt,
    localOnly: true,
    secretsReturned: false,
    timezone: options.timezone,
    dateKey,
    cacheState: providers.length === 0
      ? "empty"
      : providers.some((provider) => provider.freshness === "live")
        ? "fresh"
        : "stale",
    summary: {
      providerCount: providers.length,
      includedProviderCount: includedProviders.length,
      todayLiveAmountMinor: canSum ? sum(includedProviders.map((provider) => provider.todayLiveAmountMinor ?? 0)) : null,
      currency,
    },
    providers,
  };
}

export async function readNotificationDigest(
  options: ReadNotificationDigestOptions = {},
): Promise<NotificationDigest> {
  const overview = options.overview ?? await readOperationsOverview(options);
  const todayLive = options.todayLive ?? await readTodayLiveView(options);

  return buildNotificationDigest(overview, todayLive, options.notificationPreferences);
}

export function buildNotificationDigest(
  overview: OperationsOverview,
  todayLive: TodayLiveView,
  preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES,
): NotificationDigest {
  const criticalAlerts = overview.summary.criticalAlertCount;
  const warningAlerts = overview.summary.alertCount - criticalAlerts;
  const status = criticalAlerts > 0
    ? "critical"
    : warningAlerts > 0 || overview.summary.healthStatus !== "ok"
      ? "attention"
      : "ok";
  const items: NotificationDigestItem[] = [
    {
      widgetKey: "month_forecast",
      kind: "summary",
      severity: "info",
      label: "Month estimate",
      value: formatMinorAmount(overview.summary.totalEstimatedAmountMinor, overview.summary.currency),
    },
    {
      widgetKey: "today_live_cost",
      kind: "live",
      severity: "info",
      label: "Today live",
      value: todayLive.summary.todayLiveAmountMinor === null
        ? "Not available"
        : formatMinorAmount(todayLive.summary.todayLiveAmountMinor, todayLive.summary.currency),
    },
  ];

  if (criticalAlerts > 0) {
    items.push({
      widgetKey: "risk_high_count",
      kind: "risk",
      severity: "critical",
      label: "Critical alerts",
      value: String(criticalAlerts),
    });
  } else if (warningAlerts > 0) {
    items.push({
      widgetKey: "risk_high_count",
      kind: "risk",
      severity: "warning",
      label: "Warnings",
      value: String(warningAlerts),
    });
  }

  return {
    generatedAt: overview.generatedAt,
    localOnly: true,
    secretsReturned: false,
    title: "StackSpend",
    status,
    suppressedReason: preferences.enabled
      ? preferences.digestEnabled
        ? null
        : "digest_disabled"
      : "notifications_disabled",
    items: preferences.enabled && preferences.digestEnabled
      ? filterDigestItems(items, preferences.selectedWidgets)
      : [],
  };
}

export async function readTrayMenuModel(
  options: ReadTrayMenuModelOptions = {},
): Promise<TrayMenuModel> {
  const digest = options.digest ?? await readNotificationDigest(options);

  return buildTrayMenuModel(digest);
}

function filterDigestItems(
  items: readonly NotificationDigestItem[],
  selectedWidgets: readonly NotificationWidgetKey[],
): NotificationDigestItem[] {
  const selected = new Set(selectedWidgets);

  return items.filter((item) => selected.has(item.widgetKey));
}

export function buildTrayMenuModel(digest: NotificationDigest): TrayMenuModel {
  const summaryItem = digest.items.find((item) => item.kind === "summary");
  const statusLabel = digest.status === "ok"
    ? digest.suppressedReason === null
      ? "All monitored providers OK"
      : "Notifications paused"
    : digest.status === "critical"
      ? "Critical alert needs attention"
      : "Provider attention needed";

  return {
    generatedAt: digest.generatedAt,
    localOnly: true,
    secretsReturned: false,
    title: digest.title,
    subtitle: summaryItem?.value ?? "No local data",
    status: digest.status,
    items: [
      {
        id: "status",
        label: digest.suppressedReason === null ? statusLabel : `${statusLabel}: ${digest.suppressedReason}`,
        enabled: false,
        kind: "status",
      },
      {
        id: "open-dashboard",
        label: "Open Dashboard",
        enabled: true,
        kind: "command",
      },
      {
        id: "refresh-now",
        label: "Refresh Now",
        enabled: true,
        kind: "command",
      },
      {
        id: "separator-main",
        label: "",
        enabled: false,
        kind: "separator",
      },
      {
        id: "quit",
        label: "Quit",
        enabled: true,
        kind: "command",
      },
    ],
  };
}

async function resolveStore(options: ReadOperationsOverviewOptions): Promise<ViewModelStore> {
  if (options.store !== undefined) {
    return options.store;
  }

  return options.readStore === undefined ? EMPTY_STORE : options.readStore();
}

function todayProvidersFromStore(store: ViewModelStore, dateKey: string): TodayLiveProviderView[] {
  const providerNames = new Map(store.providers.map((provider) => [provider.key, safeText(provider.displayName)]));
  const estimatesByProvider = new Map<string, ViewModelCostEstimateRecord[]>();

  for (const estimate of store.costEstimates) {
    if (!dateKeyMatchesIso(estimate.collectedAt, dateKey)) {
      continue;
    }

    estimatesByProvider.set(estimate.providerKey, [
      ...(estimatesByProvider.get(estimate.providerKey) ?? []),
      estimate,
    ]);
  }

  return [...estimatesByProvider.entries()]
    .map(([providerKey, estimates]) => {
      const currency = singleCurrency(estimates.map((estimate) => estimate.currency)) ?? DEFAULT_CURRENCY;
      const canInclude = estimates.length > 0 && estimates.every((estimate) => estimate.currency === currency);

      return {
        providerKey: safeText(providerKey),
        displayName: providerNames.get(providerKey) ?? safeText(providerKey),
        checkedAt: latestIso(estimates.map((estimate) => estimate.collectedAt)),
        freshness: "stale" as const,
        confidence: highestConfidence(estimates.map((estimate) => estimate.confidence)),
        todayLiveAmountMinor: canInclude ? sum(estimates.map((estimate) => estimate.estimatedAmountMinor)) : null,
        currency,
        included: canInclude,
        metrics: [],
      };
    })
    .sort((first, second) => first.providerKey.localeCompare(second.providerKey));
}

function summarizeHealth(statuses: readonly ViewModelHealthStatus[]): ViewModelHealthStatus {
  if (statuses.includes("down")) {
    return "down";
  }

  if (statuses.includes("degraded")) {
    return "degraded";
  }

  if (statuses.includes("unknown") || statuses.length === 0) {
    return "unknown";
  }

  return "ok";
}

function summarizeRisk(
  severities: readonly ViewModelRiskSeverity[],
  healthStatus: ViewModelHealthStatus,
): OperationsOverviewProvider["riskLevel"] {
  if (severities.includes("critical") || healthStatus === "down") {
    return "critical";
  }

  if (severities.includes("warning") || healthStatus === "degraded" || healthStatus === "unknown") {
    return "warning";
  }

  return "low";
}

function highestConfidence(
  values: readonly ViewModelCostEstimateRecord["confidence"][],
): TodayLiveProviderView["confidence"] {
  if (values.includes("high")) {
    return "high";
  }

  if (values.includes("medium")) {
    return "medium";
  }

  if (values.includes("low")) {
    return "low";
  }

  return "none";
}

function summarizeCurrency(currencies: readonly string[]): string {
  const normalized = new Set(
    currencies
      .map((currency) => safeText(currency.toUpperCase()))
      .filter((currency) => currency.length > 0),
  );

  if (normalized.size === 0) {
    return DEFAULT_CURRENCY;
  }

  if (normalized.size > 1) {
    return "MIXED";
  }

  return [...normalized][0] ?? DEFAULT_CURRENCY;
}

function singleCurrency(currencies: readonly string[]): string | null {
  const normalized = currencies
    .map((currency) => safeText(currency.toUpperCase()))
    .filter((currency) => currency.length > 0);
  const values = new Set(normalized);

  return values.size === 1 ? normalized[0] ?? null : null;
}

function latestIso(values: readonly string[]): string | null {
  return values.length === 0
    ? null
    : [...values].sort((first, second) => second.localeCompare(first))[0] ?? null;
}

function dateKeyMatchesIso(value: string, dateKey: string): boolean {
  return value.startsWith(dateKey);
}

function dateKeyInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return [
    parts.find((part) => part.type === "year")?.value ?? "1970",
    parts.find((part) => part.type === "month")?.value ?? "01",
    parts.find((part) => part.type === "day")?.value ?? "01",
  ].join("-");
}

function formatMinorAmount(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toFixed(2)}`;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function safeText(value: string): string {
  return value.replace(SENSITIVE_TEXT_PATTERN, "[redacted]");
}
