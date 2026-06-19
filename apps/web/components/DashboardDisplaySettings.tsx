"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import type { Messages } from "../lib/i18n";
import {
  DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DASHBOARD_VIEW_KEYS,
  DASHBOARD_WIDGET_SIZES,
  LOCAL_CLI_DASHBOARD_METRIC_KEYS,
  type DashboardViewKey,
  type DashboardWidgetKey,
  type DashboardWidgetLayoutItem,
  type DashboardWidgetLayoutPreferences,
  type DashboardWidgetSize,
  type LocalCliDashboardMetricKey,
  type NotificationPreferences,
} from "./NotificationSettingsModel";
import { withAppLoading } from "./AppLoadingOverlay";

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";

export function DashboardDisplaySettings({ messages }: { messages: Messages }) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [selectedMetricKeys, setSelectedMetricKeys] = useState<LocalCliDashboardMetricKey[]>([
    ...DEFAULT_LOCAL_CLI_DASHBOARD_METRIC_KEYS,
  ]);
  const [activeViewKey, setActiveViewKey] = useState<DashboardViewKey>("overview");
  const [widgetLayouts, setWidgetLayouts] = useState<DashboardWidgetLayoutPreferences>(
    cloneDashboardWidgetLayouts(DEFAULT_NOTIFICATION_PREFERENCES.dashboard.widgetLayouts),
  );
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [statusMessage, setStatusMessage] = useState(messages.settings.notificationStoredLocally);

  useEffect(() => {
    let mounted = true;

    void loadNotificationPreferences().then((loadedPreferences) => {
      if (!mounted) {
        return;
      }

      setPreferences(loadedPreferences);
      setSelectedMetricKeys([...loadedPreferences.dashboard.localCliMetricKeys]);
      setWidgetLayouts(cloneDashboardWidgetLayouts(loadedPreferences.dashboard.widgetLayouts));
      setStatusMessage(messages.settings.notificationStoredLocally);
      setSaveState("idle");
    }).catch(() => {
      if (!mounted) {
        return;
      }

      setStatusMessage(messages.settings.dashboardDisplayPrefsLoadError);
      setSaveState("error");
    });

    return () => {
      mounted = false;
    };
  }, [
    messages.settings.dashboardDisplayPrefsLoadError,
    messages.settings.notificationStoredLocally,
  ]);

  return (
    <section className="panel">
      <div className="panel-header compact-header">
        <div className="notification-title-line">
          <SlidersHorizontal aria-hidden="true" size={17} strokeWidth={1.9} />
          <div>
            <h2 className="panel-title">{messages.settings.localCliDashboardTitle}</h2>
            <p className="metric-meta">{messages.settings.localCliDashboardSubtitle}</p>
          </div>
        </div>
        <div className="notification-header-actions">
          <span className="badge badge-live">{selectedMetricKeys.length}</span>
          <button
            className="primary-button notification-save-button"
            disabled={saveState === "loading" || saveState === "saving"}
            onClick={() => {
              void saveDashboardDisplayPreferences();
            }}
            type="button"
          >
            {saveState === "saving" ? messages.settings.toolLoadingPreparingView : messages.settings.saveDashboardDisplay}
          </button>
        </div>
      </div>
      <p
        className={saveState === "error" ? "notification-save-status notification-save-status-error" : "notification-save-status"}
        role="status"
      >
        {saveState === "saved" ? messages.settings.dashboardDisplayPrefsSaved : statusMessage}
      </p>
      <div className="panel-body">
        <div className="notification-widget-grid dashboard-cli-metric-grid" aria-label={messages.settings.localCliDashboardMetricSelection}>
          {LOCAL_CLI_DASHBOARD_METRIC_KEYS.map((metricKey) => {
            const selectedIndex = selectedMetricKeys.indexOf(metricKey);
            const selected = selectedIndex >= 0;

            return (
              <label
                className={selected ? "notification-widget-card" : "notification-widget-card notification-widget-card-muted"}
                key={metricKey}
              >
                <input
                  checked={selected}
                  onChange={() => setSelectedMetricKeys((current) => toggleRequiredMetricKey(current, metricKey))}
                  type="checkbox"
                />
                <span>
                  <strong>{localCliDashboardMetricLabel(metricKey, messages)}</strong>
                  <span className="metric-meta">
                    {messages.settings.widgetOrder}: {selected ? selectedIndex + 1 : "-"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="dashboard-widget-settings">
          <div className="settings-section-heading">
            <h3 className="panel-title">{messages.settings.dashboardWidgetsTitle}</h3>
            <p className="metric-meta">{messages.settings.dashboardWidgetsSubtitle}</p>
          </div>
          <nav className="segmented-control segmented-control-wide dashboard-widget-screen-tabs" aria-label={messages.settings.dashboardWidgetScreen}>
            {DASHBOARD_VIEW_KEYS.map((viewKey) => (
              <button
                className={activeViewKey === viewKey ? "segment segment-active" : "segment"}
                key={viewKey}
                onClick={() => setActiveViewKey(viewKey)}
                type="button"
              >
                {dashboardViewLabel(viewKey, messages)}
              </button>
            ))}
          </nav>
          <div className="dashboard-widget-layout-list" aria-label={messages.settings.dashboardWidgetSelection}>
            {widgetLayouts[activeViewKey].map((item, index) => {
              const label = dashboardWidgetLabel(item.widgetKey, messages);

              return (
                <article
                  className={item.visible ? "dashboard-widget-layout-row" : "dashboard-widget-layout-row dashboard-widget-layout-row-muted"}
                  key={item.widgetKey}
                >
                  <label className="dashboard-widget-visible-toggle">
                    <input
                      checked={item.visible}
                      onChange={() => setWidgetLayouts((current) => updateDashboardWidget(
                        current,
                        activeViewKey,
                        item.widgetKey,
                        { visible: !item.visible },
                      ))}
                      type="checkbox"
                    />
                    {item.visible ? <Eye aria-hidden="true" size={15} /> : <EyeOff aria-hidden="true" size={15} />}
                    <span>
                      <strong>{label}</strong>
                      <span className="metric-meta">
                        {messages.settings.widgetOrder}: {index + 1} - {dashboardWidgetSizeLabel(item.size, messages)}
                      </span>
                    </span>
                  </label>
                  <div className="dashboard-widget-layout-controls">
                    <button
                      aria-label={`${label} ${messages.settings.dashboardWidgetMoveUp}`}
                      className="icon-button"
                      disabled={index === 0}
                      onClick={() => setWidgetLayouts((current) => moveDashboardWidget(current, activeViewKey, index, -1))}
                      title={messages.settings.dashboardWidgetMoveUp}
                      type="button"
                    >
                      <ArrowUp aria-hidden="true" size={15} />
                    </button>
                    <button
                      aria-label={`${label} ${messages.settings.dashboardWidgetMoveDown}`}
                      className="icon-button"
                      disabled={index === widgetLayouts[activeViewKey].length - 1}
                      onClick={() => setWidgetLayouts((current) => moveDashboardWidget(current, activeViewKey, index, 1))}
                      title={messages.settings.dashboardWidgetMoveDown}
                      type="button"
                    >
                      <ArrowDown aria-hidden="true" size={15} />
                    </button>
                    <label className="compact-select-field">
                      <span>{messages.settings.dashboardWidgetSize}</span>
                      <select
                        onChange={(event) => setWidgetLayouts((current) => updateDashboardWidget(
                          current,
                          activeViewKey,
                          item.widgetKey,
                          { size: event.target.value as DashboardWidgetSize },
                        ))}
                        value={item.size}
                      >
                        {DASHBOARD_WIDGET_SIZES.map((size) => (
                          <option key={size} value={size}>{dashboardWidgetSizeLabel(size, messages)}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );

  async function saveDashboardDisplayPreferences() {
    await withAppLoading(messages.settings.toolLoadingPreparingView, async () => {
      try {
        setSaveState("saving");
        setStatusMessage(messages.settings.notificationStoredLocally);
        const session = await createLocalSession();
        const nextPreferences: NotificationPreferences = {
          ...preferences,
          dashboard: {
            ...preferences.dashboard,
            localCliMetricKeys: selectedMetricKeys,
            widgetLayouts,
          },
        };
        const response = await fetch("/api/notification-preferences", {
          body: JSON.stringify(nextPreferences),
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-MoneySiren-CSRF": session.csrfToken,
          },
          method: "PUT",
        });

        if (!response.ok) {
          throw new Error(`Save failed with status ${response.status}.`);
        }

        const payload = await response.json() as { preferences?: NotificationPreferences };

        if (payload.preferences !== undefined) {
          setPreferences(payload.preferences);
          setSelectedMetricKeys([...payload.preferences.dashboard.localCliMetricKeys]);
          setWidgetLayouts(cloneDashboardWidgetLayouts(payload.preferences.dashboard.widgetLayouts));
        }

        setStatusMessage(messages.settings.notificationStoredLocally);
        setSaveState("saved");
      } catch {
        setStatusMessage(messages.settings.dashboardDisplayPrefsSaveError);
        setSaveState("error");
      }
    });
  }
}

function cloneDashboardWidgetLayouts(
  layouts: DashboardWidgetLayoutPreferences,
): DashboardWidgetLayoutPreferences {
  return {
    overview: layouts.overview.map((item) => ({ ...item })),
    today: layouts.today.map((item) => ({ ...item })),
    forecast: layouts.forecast.map((item) => ({ ...item })),
    risks: layouts.risks.map((item) => ({ ...item })),
  };
}

function updateDashboardWidget(
  layouts: DashboardWidgetLayoutPreferences,
  viewKey: DashboardViewKey,
  widgetKey: DashboardWidgetKey,
  patch: Partial<Pick<DashboardWidgetLayoutItem, "visible" | "size">>,
): DashboardWidgetLayoutPreferences {
  return {
    ...layouts,
    [viewKey]: layouts[viewKey].map((item) =>
      item.widgetKey === widgetKey
        ? { ...item, ...patch }
        : item
    ),
  };
}

function moveDashboardWidget(
  layouts: DashboardWidgetLayoutPreferences,
  viewKey: DashboardViewKey,
  index: number,
  direction: -1 | 1,
): DashboardWidgetLayoutPreferences {
  const nextIndex = index + direction;
  const currentLayout = [...layouts[viewKey]];

  if (nextIndex < 0 || nextIndex >= currentLayout.length) {
    return layouts;
  }

  const currentItem = currentLayout[index];
  const swapItem = currentLayout[nextIndex];

  if (currentItem === undefined || swapItem === undefined) {
    return layouts;
  }

  currentLayout[index] = swapItem;
  currentLayout[nextIndex] = currentItem;

  return {
    ...layouts,
    [viewKey]: currentLayout,
  };
}

function dashboardViewLabel(viewKey: DashboardViewKey, messages: Messages): string {
  if (viewKey === "today") {
    return messages.nav.today;
  }

  if (viewKey === "forecast") {
    return messages.nav.forecast;
  }

  if (viewKey === "risks") {
    return messages.nav.risks;
  }

  return messages.nav.overview;
}

function dashboardWidgetLabel(widgetKey: DashboardWidgetKey, messages: Messages): string {
  if (widgetKey === "overview_meta") {
    return messages.app.generated;
  }

  if (widgetKey === "overview_metrics") {
    return messages.dashboard.overviewTitle;
  }

  if (widgetKey === "overview_trend") {
    return messages.dashboard.dailyUsageTrend;
  }

  if (widgetKey === "overview_grouping") {
    return messages.dashboard.groupBy;
  }

  if (widgetKey === "overview_services" || widgetKey === "forecast_table") {
    return messages.nav.services;
  }

  if (widgetKey === "overview_insights") {
    return messages.services.currentUsage;
  }

  if (widgetKey === "today_main") {
    return messages.dashboard.todayTitle;
  }

  if (widgetKey === "today_rail") {
    return messages.dashboard.todayLive;
  }

  if (widgetKey === "forecast_metrics" || widgetKey === "forecast_breakdown") {
    return messages.dashboard.forecastTitle;
  }

  if (widgetKey === "risks_summary" || widgetKey === "risks_table") {
    return messages.dashboard.risksTitle;
  }

  return widgetKey;
}

function dashboardWidgetSizeLabel(size: DashboardWidgetSize, messages: Messages): string {
  if (size === "compact") {
    return messages.settings.dashboardWidgetCompact;
  }

  if (size === "wide") {
    return messages.settings.dashboardWidgetWide;
  }

  if (size === "full") {
    return messages.settings.dashboardWidgetFull;
  }

  return messages.settings.dashboardWidgetNormal;
}

async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await fetch("/api/notification-preferences", {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Load failed with status ${response.status}.`);
  }

  const payload = await response.json() as { preferences?: NotificationPreferences };

  if (payload.preferences === undefined) {
    throw new Error("Notification preferences payload is missing.");
  }

  return payload.preferences;
}

async function createLocalSession(): Promise<{ csrfToken: string }> {
  const response = await fetch("/api/auth/session", {
    credentials: "same-origin",
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Session failed with status ${response.status}.`);
  }

  return await response.json() as { csrfToken: string };
}

function toggleRequiredMetricKey(
  current: readonly LocalCliDashboardMetricKey[],
  metricKey: LocalCliDashboardMetricKey,
): LocalCliDashboardMetricKey[] {
  if (!current.includes(metricKey)) {
    return [...current, metricKey];
  }

  return current.length <= 1 ? [...current] : current.filter((item) => item !== metricKey);
}

function localCliDashboardMetricLabel(metricKey: LocalCliDashboardMetricKey, messages: Messages): string {
  if (metricKey === "context_percent") {
    return messages.services.contextPercent;
  }

  if (metricKey === "last_request_tokens") {
    return messages.services.lastRequestTokens;
  }

  if (metricKey === "total_tokens") {
    return messages.services.totalTokens;
  }

  if (metricKey === "five_hour_limit_percent") {
    return messages.services.fiveHourLimit;
  }

  if (metricKey === "weekly_limit_percent") {
    return messages.services.weeklyLimit;
  }

  if (metricKey === "five_hour_remaining_tokens") {
    return messages.services.fiveHourRemainingTokens;
  }

  if (metricKey === "weekly_remaining_tokens") {
    return messages.services.weeklyRemainingTokens;
  }

  if (metricKey === "usage_reset_credits") {
    return messages.services.usageResetCredits;
  }

  if (metricKey === "usage_reset_credit_estimate") {
    return messages.services.usageResetCreditEstimate;
  }

  if (metricKey === "context_tokens") {
    return messages.services.contextTokens;
  }

  if (metricKey === "input_tokens") {
    return messages.services.inputTokens;
  }

  if (metricKey === "output_tokens") {
    return messages.services.outputTokens;
  }

  if (metricKey === "cache_tokens") {
    return messages.services.cacheTokens;
  }

  if (metricKey === "reasoning_tokens") {
    return messages.services.reasoningTokens;
  }

  if (metricKey === "sessions") {
    return messages.services.sessions;
  }

  if (metricKey === "turns") {
    return messages.services.turns;
  }

  if (metricKey === "tool_calls") {
    return messages.services.toolCalls;
  }

  return messages.services.logFiles;
}
