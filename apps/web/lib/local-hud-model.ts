import "server-only";

import {
  buildHudViewModel,
  filterHudViewModelByWidgets,
  type HudViewModel,
  type NotificationWidgetKey,
} from "../../../packages/view-model/src/index";
import {
  readLiveTodaySnapshot,
  refreshLiveToday,
  type LiveTodayOptions,
  type LiveTodaySnapshot,
  type RefreshScope,
} from "./live-today";
import { readWebNotificationPreferences, todayLiveViewFromSnapshot } from "./local-notification-model";

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
  const [liveToday, selectedWidgets] = await Promise.all([
    readLiveTodaySnapshot({
      ...options,
      scope: "hud",
    }),
    readHudSelectedWidgets(options),
  ]);

  return filterHudViewModelByWidgets(buildHudViewModel(todayLiveViewFromSnapshot(liveToday)), selectedWidgets);
}

export async function refreshLocalLiveData(options: {
  scope: RefreshScope;
} & LocalHudOptions): Promise<LocalRefreshLiveResult> {
  const [liveToday, selectedWidgets] = await Promise.all([
    refreshLiveToday(options),
    readHudSelectedWidgets(options),
  ]);
  const hud = filterHudViewModelByWidgets(buildHudViewModel(todayLiveViewFromSnapshot(liveToday)), selectedWidgets);
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

async function readHudSelectedWidgets(options: LocalHudOptions): Promise<readonly NotificationWidgetKey[]> {
  if (options.selectedWidgets !== undefined) {
    return options.selectedWidgets;
  }

  return (await readWebNotificationPreferences(
    options.env === undefined ? {} : { env: options.env },
  )).hud.selectedWidgets;
}

export async function readUnfilteredLocalHudViewModel(
  options: LocalHudLiveOptions = {},
): Promise<HudViewModel> {
  const liveToday = await readLiveTodaySnapshot({
    ...options,
    scope: "hud",
  });

  return buildHudViewModel(todayLiveViewFromSnapshot(liveToday));
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
