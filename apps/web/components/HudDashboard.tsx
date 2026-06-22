"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Clock, RotateCw } from "lucide-react";
import type { CreditAccuracy, HudItemView, HudViewModel, QuotaItemView } from "../../../packages/view-model/src/hud-model";
import type { Locale } from "../lib/i18n";
import type { NotificationPreferences } from "./NotificationSettingsModel";
import { refreshLocalLive } from "../lib/local-client";
import { HudWindowControls } from "./HudWindowControls";
import { UsageProgress } from "./UsageProgress";

const HUD_POLL_INTERVAL_MS = 5 * 60_000;
const HUD_TIME_ZONE = "Asia/Seoul";

export interface HudDashboardLabels {
  title: string;
  items: string;
  empty: string;
  ok: string;
  partial: string;
  stale: string;
  error: string;
  freshItems: string;
  staleItems: string;
  errorItems: string;
  generatedAt: string;
  lastSuccessAt: string;
  syncFailed: string;
  refreshFailed: string;
  used: string;
  remaining: string;
  resetAt: string;
  fiveHour: string;
  weekly: string;
  context: string;
  resetCredits: string;
  resetCreditExpiry: string;
  expiresAt: string;
  estimatedExpiry: string;
  unresolvedCredits: string;
  exact: string;
  estimated: string;
  bounded: string;
  unknown: string;
  active: string;
  expiringSoon: string;
  expired: string;
  noExpiry: string;
  openTarget: string;
}

interface HudDashboardProps {
  initialModel: HudViewModel;
  initialPreferences: NotificationPreferences;
  controlLabels: Parameters<typeof HudWindowControls>[0]["labels"];
  labels: HudDashboardLabels;
  locale: Locale;
}

export function HudDashboard({
  initialModel,
  initialPreferences,
  controlLabels,
  labels,
  locale,
}: HudDashboardProps) {
  const [model, setModel] = useState(initialModel);
  const [polling, setPolling] = useState(false);
  const [manualRefreshBusy, setManualRefreshBusy] = useState(false);
  const [transportError, setTransportError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadHud = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPolling(true);

    try {
      const response = await fetch("/api/local/hud", {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HUD load failed with status ${response.status}.`);
      }

      const payload = await response.json() as unknown;

      if (!isHudViewModel(payload)) {
        throw new Error("HUD payload shape is invalid.");
      }

      setModel(payload);
      setTransportError(null);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setTransportError(labels.refreshFailed);
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }

      setPolling(false);
    }
  }, [labels.refreshFailed]);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;

    const schedule = () => {
      timer = window.setTimeout(async () => {
        await loadHud();

        if (!stopped) {
          schedule();
        }
      }, HUD_POLL_INTERVAL_MS);
    };
    const loadIfVisible = () => {
      if (document.visibilityState !== "hidden") {
        void loadHud();
      }
    };

    schedule();
    window.addEventListener("focus", loadIfVisible);
    window.addEventListener("online", loadIfVisible);
    window.addEventListener("moneysiren:live-refresh", loadIfVisible);
    document.addEventListener("visibilitychange", loadIfVisible);

    return () => {
      stopped = true;
      abortRef.current?.abort();

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }

      window.removeEventListener("focus", loadIfVisible);
      window.removeEventListener("online", loadIfVisible);
      window.removeEventListener("moneysiren:live-refresh", loadIfVisible);
      document.removeEventListener("visibilitychange", loadIfVisible);
    };
  }, [loadHud]);

  return (
    <>
      <HudWindowControls
        initialPreferences={initialPreferences}
        labels={controlLabels}
        locale={locale}
        onRefresh={() => {
          void handleManualRefresh();
        }}
        refreshBusy={manualRefreshBusy || polling}
      />
      <header className="hud-header" data-tauri-drag-region>
        <div>
          <h1>{labels.title}</h1>
          <span className="hud-header-meta">
            {labels.generatedAt}: {formatDateTime(model.generatedAt, locale)}
          </span>
        </div>
        <span className={`badge ${syncStatusBadgeClass(model.sync.status)}`}>
          {syncStatusLabel(model.sync.status, labels)}
        </span>
      </header>
      <section className="hud-sync-row" aria-live="polite">
        <span>{labels.freshItems}: {model.sync.freshCount}</span>
        <span>{labels.staleItems}: {model.sync.staleCount}</span>
        <span>{labels.errorItems}: {model.sync.errorCount}</span>
      </section>
      {transportError === null ? null : (
        <div className="hud-inline-error" role="status">
          <AlertTriangle aria-hidden="true" size={13} />
          <span>{transportError}</span>
        </div>
      )}
      <section className="hud-item-list" aria-label={labels.items}>
        {model.items.length === 0 ? (
          <div className="hud-empty">
            <strong>{labels.empty}</strong>
          </div>
        ) : model.items.map((item) => (
          <HudItemCard item={item} key={item.id} labels={labels} locale={locale} modelGeneratedAt={model.generatedAt} />
        ))}
      </section>
      {manualRefreshBusy || polling ? (
        <div className="hud-refresh-indicator" role="status">
          <RotateCw aria-hidden="true" size={12} />
        </div>
      ) : null}
    </>
  );

  async function handleManualRefresh(): Promise<void> {
    setManualRefreshBusy(true);

    try {
      await refreshLocalLive("hud");
      await loadHud();
    } catch {
      setTransportError(labels.refreshFailed);
    } finally {
      setManualRefreshBusy(false);
    }
  }
}

function HudItemCard({
  item,
  labels,
  locale,
  modelGeneratedAt,
}: {
  item: HudItemView;
  labels: HudDashboardLabels;
  locale: Locale;
  modelGeneratedAt: string;
}) {
  const href = targetHref(item, locale);
  const syncError = item.sync.error?.message ?? null;

  if (item.kind === "quota") {
    const windowLabel = quotaWindowLabel(item.window, labels);
    const used = item.progress.usedPercent === null ? labels.unknown : formatPercent(item.progress.usedPercent, locale);
    const remaining = item.progress.remainingPercent === null ? labels.unknown : formatPercent(item.progress.remainingPercent, locale);

    return (
      <a className="hud-item hud-item-rich" href={href} title={labels.openTarget}>
        <span className="hud-item-copy">
          <strong>{providerLabel(item.providerKey)} · {windowLabel}</strong>
          <span className="hud-item-detail">
            {labels.used} {used} · {labels.remaining} {remaining}
          </span>
          <UsageProgress compact label={`${providerLabel(item.providerKey)} ${windowLabel}`} progress={item.progress} />
          <HudSyncDetail error={syncError} item={item} labels={labels} locale={locale} />
        </span>
        <span className={`hud-value hud-value-${item.riskSeverity}`}>{used}</span>
      </a>
    );
  }

  const count = item.availableCount === null ? labels.unknown : new Intl.NumberFormat(locale).format(item.availableCount);
  const expiryValue = item.nearestExpiryAt === null
    ? labels.noExpiry
    : formatRelative(item.nearestExpiryAt, modelGeneratedAt, locale);
  const expiryDetail = item.nearestExpiryAt === null
    ? labels.noExpiry
    : `${expiryValue} · ${formatDateTime(item.nearestExpiryAt, locale)}`;
  const title = item.variant === "count" ? labels.resetCredits : labels.resetCreditExpiry;
  const detail = item.variant === "count"
    ? expiryDetail
    : `${labels.resetCredits}: ${count}`;
  const value = item.variant === "count" ? count : expiryValue;

  return (
    <a className="hud-item hud-item-rich" href={href} title={labels.openTarget}>
      <span className="hud-item-copy">
        <strong>{providerLabel(item.providerKey)} · {title}</strong>
        <span className="hud-item-detail">{detail}</span>
        <span className="hud-credit-meta">
          {accuracyLabel(item.accuracy, labels)}
          {item.unresolvedCount > 0 ? ` · ${labels.unresolvedCredits}: ${item.unresolvedCount}` : ""}
        </span>
        {item.credits.slice(0, 2).map((credit) => (
          <span className="hud-credit-row" key={credit.itemKey}>
            <Clock aria-hidden="true" size={11} />
            <span>{creditLabel(credit.status, labels)}</span>
            <span>{creditTimeLabel(credit, labels, locale)}</span>
          </span>
        ))}
        <HudSyncDetail error={syncError} item={item} labels={labels} locale={locale} />
      </span>
      <span className={`hud-value hud-value-${item.riskSeverity}`}>{value}</span>
    </a>
  );
}

function HudSyncDetail({
  error,
  item,
  labels,
  locale,
}: {
  error: string | null;
  item: HudItemView;
  labels: HudDashboardLabels;
  locale: Locale;
}) {
  if (error !== null) {
    return <span className="hud-sync-detail hud-sync-detail-error">{labels.syncFailed}: {error}</span>;
  }

  if (item.sync.lastSuccessAt === null) {
    return null;
  }

  return <span className="hud-sync-detail">{labels.lastSuccessAt}: {formatDateTime(item.sync.lastSuccessAt, locale)}</span>;
}

function isHudViewModel(value: unknown): value is HudViewModel {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<HudViewModel>;

  return record.localOnly === true &&
    record.secretsReturned === false &&
    typeof record.generatedAt === "string" &&
    Array.isArray(record.items) &&
    typeof record.sync === "object" &&
    record.sync !== null;
}

function targetHref(item: HudItemView, locale: Locale): string {
  if (item.target.type === "service" && item.target.providerKey !== undefined) {
    return `/${locale}/services/${item.target.providerKey}`;
  }

  return `/${locale}/dashboard/overview`;
}

function providerLabel(providerKey: string): string {
  if (providerKey === "codex-app") {
    return "Codex App";
  }

  if (providerKey === "codex-cli") {
    return "Codex CLI";
  }

  if (providerKey === "claude-app") {
    return "Claude App";
  }

  if (providerKey === "claude-cli") {
    return "Claude CLI";
  }

  if (providerKey === "antigravity") {
    return "Antigravity";
  }

  return providerKey;
}

function quotaWindowLabel(window: QuotaItemView["window"], labels: HudDashboardLabels): string {
  if (window === "five_hour") {
    return labels.fiveHour;
  }

  if (window === "weekly") {
    return labels.weekly;
  }

  return labels.context;
}

function accuracyLabel(value: CreditAccuracy, labels: HudDashboardLabels): string {
  if (value === "exact") {
    return labels.exact;
  }

  if (value === "estimated") {
    return labels.estimated;
  }

  if (value === "bounded") {
    return labels.bounded;
  }

  return labels.unknown;
}

function creditLabel(value: "active" | "expiring_soon" | "expired" | "unknown", labels: HudDashboardLabels): string {
  if (value === "active") {
    return labels.active;
  }

  if (value === "expiring_soon") {
    return labels.expiringSoon;
  }

  if (value === "expired") {
    return labels.expired;
  }

  return labels.unknown;
}

function creditTimeLabel(
  credit: Extract<HudItemView, { kind: "credit_pool" }>["credits"][number],
  labels: HudDashboardLabels,
  locale: Locale,
): string {
  if (credit.expiresAt !== null) {
    return `${labels.expiresAt}: ${formatDateTime(credit.expiresAt, locale)}`;
  }

  if (credit.estimatedEarliestAt !== null && credit.estimatedLatestAt !== null) {
    return `${labels.estimatedExpiry}: ${formatDateTime(credit.estimatedEarliestAt, locale)} - ${formatDateTime(credit.estimatedLatestAt, locale)}`;
  }

  if (credit.estimatedEarliestAt !== null) {
    return `${labels.estimatedExpiry}: ${formatDateTime(credit.estimatedEarliestAt, locale)}`;
  }

  return labels.noExpiry;
}

function syncStatusLabel(status: HudViewModel["sync"]["status"], labels: HudDashboardLabels): string {
  if (status === "ok") {
    return labels.ok;
  }

  if (status === "partial") {
    return labels.partial;
  }

  if (status === "stale") {
    return labels.stale;
  }

  if (status === "error") {
    return labels.error;
  }

  return labels.empty;
}

function syncStatusBadgeClass(status: HudViewModel["sync"]["status"]): string {
  if (status === "ok") {
    return "badge-ok";
  }

  if (status === "error") {
    return "badge-critical";
  }

  if (status === "partial" || status === "stale") {
    return "badge-warn";
  }

  return "badge-neutral";
}

function formatPercent(value: number, locale: Locale): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)}%`;
}

function formatDateTime(value: string, locale: Locale): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: HUD_TIME_ZONE,
  }).format(date);
}

function formatRelative(value: string, base: string, locale: Locale): string {
  const target = Date.parse(value);
  const now = Date.parse(base);

  if (!Number.isFinite(target) || !Number.isFinite(now)) {
    return value;
  }

  const seconds = Math.round((target - now) / 1000);
  const absSeconds = Math.abs(seconds);

  if (absSeconds >= 86_400) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(Math.round(seconds / 86_400), "day");
  }

  if (absSeconds >= 3_600) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(Math.round(seconds / 3_600), "hour");
  }

  return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(Math.round(seconds / 60), "minute");
}
