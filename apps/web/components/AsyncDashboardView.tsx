"use client";

import { useEffect, useState } from "react";
import {
  ForecastView,
  OverviewView,
  PageHeader,
  RisksView,
  TodayLiveView,
  type DashboardGrouping,
} from "./OperationsViews";
import type { Messages, Locale } from "../lib/i18n";
import type { OperationsDashboard } from "../lib/operations-data";

type DashboardScreen = "overview" | "today" | "forecast" | "risks";

interface AsyncDashboardViewProps {
  grouping: DashboardGrouping;
  groupingBasePath: string;
  locale: Locale;
  messages: Messages;
  screen: DashboardScreen;
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; dashboard: OperationsDashboard }
  | { status: "error"; message: string };

export function AsyncDashboardView({
  grouping,
  groupingBasePath,
  locale,
  messages,
  screen,
}: AsyncDashboardViewProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard(): Promise<void> {
      setState({ status: "loading" });

      try {
        const response = await fetch("/api/operations-dashboard", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Dashboard load failed with status ${response.status}.`);
        }

        const payload = await response.json() as unknown;

        if (!isOperationsDashboard(payload)) {
          throw new Error("Dashboard payload shape is invalid.");
        }

        setState({ status: "ready", dashboard: payload });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Dashboard load failed.",
          });
        }
      }
    }

    void loadDashboard();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <>
      {screen === "overview" ? null : (
        <PageHeader
          title={titleForScreen(screen, messages)}
          subtitle={subtitleForScreen(screen, messages)}
        />
      )}
      {state.status === "ready" ? (
        <DashboardScreenView
          dashboard={state.dashboard}
          grouping={grouping}
          groupingBasePath={groupingBasePath}
          locale={locale}
          messages={messages}
          screen={screen}
        />
      ) : state.status === "error" ? (
        <DashboardAsyncError message={state.message} messages={messages} />
      ) : (
        <DashboardAsyncLoading messages={messages} />
      )}
    </>
  );
}

function DashboardScreenView({
  dashboard,
  grouping,
  groupingBasePath,
  locale,
  messages,
  screen,
}: {
  dashboard: OperationsDashboard;
  grouping: DashboardGrouping;
  groupingBasePath: string;
  locale: Locale;
  messages: Messages;
  screen: DashboardScreen;
}) {
  const props = {
    dashboard,
    grouping,
    groupingBasePath,
    locale,
    messages,
  };

  if (screen === "today") {
    return <TodayLiveView {...props} />;
  }

  if (screen === "forecast") {
    return <ForecastView {...props} />;
  }

  if (screen === "risks") {
    return <RisksView {...props} />;
  }

  return <OverviewView {...props} />;
}

function DashboardAsyncLoading({ messages }: { messages: Messages }) {
  return (
    <section className="dashboard-async-shell" aria-busy="true" role="status">
      <div className="dashboard-async-copy">
        <strong>{messages.settings.toolLoadingPreparingView}</strong>
        <span>{messages.settings.toolLoadingReadingUsage}</span>
      </div>
      <div className="dashboard-loading-bar" />
      <section className="metric-grid" aria-label={messages.settings.toolLoadingReadingUsage}>
        <div className="metric-card dashboard-loading-card" />
        <div className="metric-card dashboard-loading-card" />
        <div className="metric-card dashboard-loading-card" />
        <div className="metric-card dashboard-loading-card" />
      </section>
      <section className="panel dashboard-loading-panel" />
    </section>
  );
}

function DashboardAsyncError({
  message,
  messages,
}: {
  message: string;
  messages: Messages;
}) {
  return (
    <section className="panel dashboard-async-error" role="alert">
      <h2 className="panel-title">{messages.empty.noDatabase}</h2>
      <p>{message}</p>
      <p>{messages.dashboard.refresh}</p>
    </section>
  );
}

function titleForScreen(screen: DashboardScreen, messages: Messages): string {
  if (screen === "today") {
    return messages.dashboard.todayTitle;
  }

  if (screen === "forecast") {
    return messages.dashboard.forecastTitle;
  }

  if (screen === "risks") {
    return messages.dashboard.risksTitle;
  }

  return messages.dashboard.overviewTitle;
}

function subtitleForScreen(screen: DashboardScreen, messages: Messages): string {
  if (screen === "today") {
    return messages.dashboard.todaySubtitle;
  }

  if (screen === "forecast") {
    return messages.dashboard.forecastSubtitle;
  }

  if (screen === "risks") {
    return messages.dashboard.risksSubtitle;
  }

  return messages.dashboard.overviewSubtitle;
}

function isOperationsDashboard(value: unknown): value is OperationsDashboard {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<OperationsDashboard>;

  return typeof record.generatedAt === "string" &&
    typeof record.timezone === "string" &&
    typeof record.summary === "object" &&
    record.summary !== null &&
    Array.isArray(record.providers) &&
    Array.isArray(record.visibleProviders) &&
    Array.isArray(record.visibleConnections) &&
    Array.isArray(record.usageTrend) &&
    typeof record.displayPreferences === "object" &&
    record.displayPreferences !== null;
}
