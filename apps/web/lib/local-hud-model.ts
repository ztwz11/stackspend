import "server-only";

import {
  buildNotificationDigest,
  buildHudViewModel,
  DEFAULT_NOTIFICATION_PREFERENCES,
  filterHudViewModelByWidgets,
  type HudViewModel,
  NOTIFICATION_WIDGET_KEYS,
  type NotificationWidgetKey,
} from "../../../packages/view-model/src/index";
import { readDashboardSnapshot } from "./dashboard-data";
import {
  readLiveTodaySnapshot,
  refreshLiveToday,
  type LiveTodayOptions,
  type LiveTodaySnapshot,
  type RefreshScope,
} from "./live-today";
import {
  operationsOverviewFromDashboard,
  readWebNotificationPreferences,
  todayLiveViewFromSnapshot,
} from "./local-notification-model";

type LocalHudLiveOptions = Pick<
  LiveTodayOptions,
  "env" | "now" | "timezone" | "connections" | "credentialStore" | "collectors"
>;

interface LocalHudOptions extends LocalHudLiveOptions {
  selectedWidgets?: readonly NotificationWidgetKey[];
}

export interface LocalRefreshLiveResult {
  localOnly: true;
  secretsReturned: false;
  generatedAt: string;
  status: "ok" | "partial" | "error";
  refreshedProviders: readonly string[];
  failedProviders: readonly {
    providerKey: string;
    code: string;
    retryable: boolean;
  }[];
  hud: HudViewModel;
}

export async function readLocalHudViewModel(
  options: LocalHudOptions = {},
): Promise<HudViewModel> {
  const [liveToday, dashboardSnapshot, preferences] = await Promise.all([
    readLiveTodaySnapshot({
      ...options,
      scope: "hud",
    }),
    readDashboardSnapshot(dashboardSnapshotOptions(options)),
    readWebNotificationPreferences(options.env === undefined ? {} : { env: options.env }),
  ]);
  const todayLive = todayLiveViewFromSnapshot(liveToday);
  const overview = operationsOverviewFromDashboard(dashboardSnapshot);
  const digest = buildNotificationDigest(overview, todayLive, {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    selectedWidgets: NOTIFICATION_WIDGET_KEYS,
  });
  const selectedWidgets = options.selectedWidgets ?? preferences.hud.selectedWidgets;

  return filterHudViewModelByWidgets(buildHudViewModel(todayLive, { digest }), selectedWidgets);
}

export async function refreshLocalLiveData(options: {
  scope: RefreshScope;
} & LocalHudOptions): Promise<LocalRefreshLiveResult> {
  const [liveToday, dashboardSnapshot, preferences] = await Promise.all([
    refreshLiveToday(options),
    readDashboardSnapshot(dashboardSnapshotOptions(options)),
    readWebNotificationPreferences(options.env === undefined ? {} : { env: options.env }),
  ]);
  const todayLive = todayLiveViewFromSnapshot(liveToday);
  const overview = operationsOverviewFromDashboard(dashboardSnapshot);
  const digest = buildNotificationDigest(overview, todayLive, {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    selectedWidgets: NOTIFICATION_WIDGET_KEYS,
  });
  const selectedWidgets = options.selectedWidgets ?? preferences.hud.selectedWidgets;
  const hud = filterHudViewModelByWidgets(buildHudViewModel(todayLive, { digest }), selectedWidgets);
  const refreshedProviders = refreshedProviderKeys(liveToday);
  const failedProviders = failedProviderSummaries(liveToday);
  const status = failedProviders.length === 0
    ? "ok"
    : refreshedProviders.length > 0
      ? "partial"
      : "error";

  return {
    localOnly: true,
    secretsReturned: false,
    generatedAt: liveToday.generatedAt,
    status,
    refreshedProviders,
    failedProviders,
    hud,
  };
}

export async function readUnfilteredLocalHudViewModel(
  options: LocalHudLiveOptions = {},
): Promise<HudViewModel> {
  const [liveToday, dashboardSnapshot] = await Promise.all([
    readLiveTodaySnapshot({
      ...options,
      scope: "hud",
    }),
    readDashboardSnapshot(dashboardSnapshotOptions(options)),
  ]);
  const todayLive = todayLiveViewFromSnapshot(liveToday);
  const overview = operationsOverviewFromDashboard(dashboardSnapshot);
  const digest = buildNotificationDigest(overview, todayLive, {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    selectedWidgets: NOTIFICATION_WIDGET_KEYS,
  });

  return buildHudViewModel(todayLive, { digest });
}

function dashboardSnapshotOptions(options: LocalHudLiveOptions): Parameters<typeof readDashboardSnapshot>[0] {
  return {
    ...(options.env === undefined ? {} : { env: options.env }),
    ...(options.now === undefined ? {} : { now: options.now }),
  };
}

export function parseRefreshScope(value: unknown): RefreshScope | null {
  const record = typeof value === "object" && value !== null ? value as { scope?: unknown } : null;
  const scope = record?.scope;

  return scope === "hud" || scope === "local_ai" || scope === "all" ? scope : null;
}

function refreshedProviderKeys(liveToday: LiveTodaySnapshot): string[] {
  return [...new Set(
    liveToday.providers
      .filter((provider) => provider.status === "ok" || provider.status === "partial")
      .filter((provider) => provider.checkedAt !== null)
      .map((provider) => provider.providerKey),
  )].sort();
}

function failedProviderSummaries(liveToday: LiveTodaySnapshot): LocalRefreshLiveResult["failedProviders"] {
  return liveToday.providers
    .filter((provider) => provider.freshness === "error" || provider.status === "error" || provider.lastRefreshFailed === true)
    .map((provider) => ({
      providerKey: provider.providerKey,
      code: errorCodeForProviderMessage(provider.message),
      retryable: retryableErrorMessage(provider.message),
    }));
}

function errorCodeForProviderMessage(message: string | undefined): string {
  if (message === undefined) {
    return "internal";
  }

  const normalized = message.toLowerCase();

  if (normalized.includes("not configured")) {
    return "not_configured";
  }

  if (normalized.includes("credential") || normalized.includes("login") || normalized.includes("expired")) {
    return "auth_expired";
  }

  if (normalized.includes("permission") || normalized.includes("403")) {
    return "permission_denied";
  }

  if (normalized.includes("timeout")) {
    return "timeout";
  }

  if (normalized.includes("rate")) {
    return "rate_limited";
  }

  return "internal";
}

function retryableErrorMessage(message: string | undefined): boolean {
  const code = errorCodeForProviderMessage(message);

  return code === "timeout" || code === "rate_limited" || code === "internal";
}
