"use client";

import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import type { Messages } from "../lib/i18n";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "./NotificationSettingsModel";
import { SUPPORTED_DISPLAY_CURRENCIES } from "../lib/exchange-rates";
import { withAppLoading } from "./AppLoadingOverlay";

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";

export function BudgetSettings({ currentCurrency, messages }: { currentCurrency: string; messages: Messages }) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(currentCurrency);
  const [warningPercent, setWarningPercent] = useState(DEFAULT_NOTIFICATION_PREFERENCES.dashboard.budget.warningPercent);
  const [criticalPercent, setCriticalPercent] = useState(DEFAULT_NOTIFICATION_PREFERENCES.dashboard.budget.criticalPercent);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [statusMessage, setStatusMessage] = useState(messages.settings.notificationStoredLocally);

  useEffect(() => {
    let mounted = true;

    void loadNotificationPreferences().then((loadedPreferences) => {
      if (!mounted) {
        return;
      }

      setPreferences(loadedPreferences);
      setAmount(amountInputFromMinor(loadedPreferences.dashboard.budget.monthlyBudgetMinor));
      setCurrency(normalizeSupportedCurrency(loadedPreferences.dashboard.budget.currency, currentCurrency));
      setWarningPercent(loadedPreferences.dashboard.budget.warningPercent);
      setCriticalPercent(loadedPreferences.dashboard.budget.criticalPercent);
      setStatusMessage(messages.settings.notificationStoredLocally);
      setSaveState("idle");
    }).catch(() => {
      if (!mounted) {
        return;
      }

      setStatusMessage(messages.settings.budgetPrefsLoadError);
      setSaveState("error");
    });

    return () => {
      mounted = false;
    };
  }, [
    messages.settings.budgetPrefsLoadError,
    messages.settings.notificationStoredLocally,
  ]);

  return (
    <section className="panel">
      <div className="panel-header compact-header">
        <div className="notification-title-line">
          <Gauge aria-hidden="true" size={17} strokeWidth={1.9} />
          <div>
            <h2 className="panel-title">{messages.settings.budgetTitle}</h2>
            <p className="metric-meta">{messages.settings.budgetSubtitle}</p>
          </div>
        </div>
        <button
          className="primary-button notification-save-button"
          disabled={saveState === "loading" || saveState === "saving"}
          onClick={() => {
            void saveBudgetPreferences();
          }}
          type="button"
        >
          {saveState === "saving" ? messages.settings.toolLoadingPreparingView : messages.settings.saveBudget}
        </button>
      </div>
      <p
        className={saveState === "error" ? "notification-save-status notification-save-status-error" : "notification-save-status"}
        role="status"
      >
        {saveState === "saved" ? messages.settings.budgetPrefsSaved : statusMessage}
      </p>
      <div className="panel-body notification-control-grid">
        <label className="notification-field">
          <span className="metric-label">{messages.settings.monthlyBudgetLimit}</span>
          <input
            className="notification-input"
            min="0"
            onChange={(event) => setAmount(event.currentTarget.value)}
            placeholder="0.00"
            step="0.01"
            type="number"
            value={amount}
          />
        </label>
        <label className="notification-field">
          <span className="metric-label">{messages.settings.budgetCurrency}</span>
          <select
            className="notification-select"
            onChange={(event) => setCurrency(event.currentTarget.value)}
            value={currency}
          >
            {SUPPORTED_DISPLAY_CURRENCIES.map((currencyCode) => (
              <option key={currencyCode} value={currencyCode}>
                {currencyCode}
              </option>
            ))}
          </select>
        </label>
        <label className="notification-field">
          <span className="metric-label">{messages.settings.budgetWarningPercent}</span>
          <input
            className="notification-input"
            min="1"
            onChange={(event) => setWarningPercent(Number(event.currentTarget.value))}
            step="1"
            type="number"
            value={warningPercent}
          />
        </label>
        <label className="notification-field">
          <span className="metric-label">{messages.settings.budgetCriticalPercent}</span>
          <input
            className="notification-input"
            min={warningPercent}
            onChange={(event) => setCriticalPercent(Number(event.currentTarget.value))}
            step="1"
            type="number"
            value={criticalPercent}
          />
        </label>
      </div>
    </section>
  );

  async function saveBudgetPreferences() {
    await withAppLoading(messages.settings.toolLoadingPreparingView, async () => {
      try {
        setSaveState("saving");
        setStatusMessage(messages.settings.notificationStoredLocally);
        const session = await createLocalSession();
        const normalizedWarningPercent = normalizePercent(warningPercent, DEFAULT_NOTIFICATION_PREFERENCES.dashboard.budget.warningPercent);
        const normalizedCriticalPercent = Math.max(
          normalizedWarningPercent,
          normalizePercent(criticalPercent, DEFAULT_NOTIFICATION_PREFERENCES.dashboard.budget.criticalPercent),
        );
        const nextPreferences: NotificationPreferences = {
          ...preferences,
          dashboard: {
            ...preferences.dashboard,
            budget: {
              monthlyBudgetMinor: minorFromAmountInput(amount),
              currency: normalizeSupportedCurrency(currency, currentCurrency),
              warningPercent: normalizedWarningPercent,
              criticalPercent: normalizedCriticalPercent,
            },
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
          setAmount(amountInputFromMinor(payload.preferences.dashboard.budget.monthlyBudgetMinor));
          setCurrency(normalizeSupportedCurrency(payload.preferences.dashboard.budget.currency, currentCurrency));
          setWarningPercent(payload.preferences.dashboard.budget.warningPercent);
          setCriticalPercent(payload.preferences.dashboard.budget.criticalPercent);
        }

        setStatusMessage(messages.settings.notificationStoredLocally);
        setSaveState("saved");
      } catch {
        setStatusMessage(messages.settings.budgetPrefsSaveError);
        setSaveState("error");
      }
    });
  }
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

function amountInputFromMinor(minor: number | null): string {
  if (minor === null) {
    return "";
  }

  return (minor / 100).toFixed(2).replace(/\.00$/, "");
}

function minorFromAmountInput(value: string): number | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null;
}

function normalizePercent(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function normalizeCurrency(value: string, fallback: string): string {
  const normalized = value.trim().toUpperCase();

  return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
}

function normalizeSupportedCurrency(value: string, fallback: string): string {
  const normalized = normalizeCurrency(value, fallback);

  return SUPPORTED_DISPLAY_CURRENCIES.includes(normalized as (typeof SUPPORTED_DISPLAY_CURRENCIES)[number])
    ? normalized
    : "USD";
}
