"use client";

import { useEffect, useState } from "react";
import { Check, Minus, Pin, PinOff, Settings, X } from "lucide-react";
import type { Locale } from "../lib/i18n";
import type { NotificationPreferences } from "./NotificationSettingsModel";

type SaveState = "idle" | "saving" | "saved" | "error";

interface HudWindowControlsProps {
  initialPreferences: NotificationPreferences;
  labels: {
    alwaysOnTop: string;
    close: string;
    error: string;
    minimize: string;
    saved: string;
    settings: string;
  };
  locale: Locale;
}

interface TauriWindow {
  close: () => Promise<void>;
  isAlwaysOnTop: () => Promise<boolean>;
  minimize: () => Promise<void>;
  setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>;
}

export function HudWindowControls({ initialPreferences, labels, locale }: HudWindowControlsProps) {
  const [alwaysOnTop, setAlwaysOnTop] = useState(initialPreferences.hud.alwaysOnTop);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [tauriAvailable, setTauriAvailable] = useState(false);

  useEffect(() => {
    let mounted = true;

    void getCurrentHudWindow().then(async (hudWindow) => {
      if (!mounted || hudWindow === null) {
        return;
      }

      setTauriAvailable(true);
      await hudWindow.setAlwaysOnTop(initialPreferences.hud.alwaysOnTop);
      const currentAlwaysOnTop = await hudWindow.isAlwaysOnTop();

      if (mounted) {
        setAlwaysOnTop(currentAlwaysOnTop);
      }
    }).catch(() => {
      if (mounted) {
        setTauriAvailable(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [initialPreferences.hud.alwaysOnTop]);

  return (
    <>
      <div className="hud-window-controls" aria-label={labels.settings}>
        <button
          aria-expanded={controlsOpen}
          aria-label={labels.settings}
          className="hud-control-button"
          onClick={() => setControlsOpen((current) => !current)}
          title={labels.settings}
          type="button"
        >
          <Settings aria-hidden="true" size={14} strokeWidth={1.9} />
        </button>
        <button
          aria-label={labels.minimize}
          className="hud-control-button"
          disabled={!tauriAvailable}
          onClick={() => {
            void runWindowAction((hudWindow) => hudWindow.minimize());
          }}
          title={labels.minimize}
          type="button"
        >
          <Minus aria-hidden="true" size={15} strokeWidth={2} />
        </button>
        <button
          aria-label={labels.close}
          className="hud-control-button hud-control-button-danger"
          disabled={!tauriAvailable}
          onClick={() => {
            void runWindowAction((hudWindow) => hudWindow.close());
          }}
          title={labels.close}
          type="button"
        >
          <X aria-hidden="true" size={15} strokeWidth={2} />
        </button>
      </div>

      {controlsOpen ? (
        <div className="hud-settings-popover">
          <label className="hud-toggle-row">
            <input
              checked={alwaysOnTop}
              onChange={() => {
                void updateAlwaysOnTop(!alwaysOnTop);
              }}
              type="checkbox"
            />
            <span className="toggle-switch" aria-hidden="true" />
            <span>{labels.alwaysOnTop}</span>
            {alwaysOnTop ? (
              <Pin aria-hidden="true" size={13} strokeWidth={1.9} />
            ) : (
              <PinOff aria-hidden="true" size={13} strokeWidth={1.9} />
            )}
          </label>
          <a className="hud-settings-link" href={`/${locale}/settings/notifications`}>
            <Settings aria-hidden="true" size={13} strokeWidth={1.9} />
            <span>{labels.settings}</span>
          </a>
          {saveState === "saved" ? (
            <span className="hud-save-status">
              <Check aria-hidden="true" size={12} strokeWidth={2} />
              {labels.saved}
            </span>
          ) : null}
          {saveState === "error" ? <span className="hud-save-status hud-save-status-error">{labels.error}</span> : null}
        </div>
      ) : null}
    </>
  );

  async function updateAlwaysOnTop(nextAlwaysOnTop: boolean) {
    const previousAlwaysOnTop = alwaysOnTop;

    setAlwaysOnTop(nextAlwaysOnTop);
    setSaveState("saving");

    try {
      const hudWindow = await getCurrentHudWindow();

      if (hudWindow !== null) {
        await hudWindow.setAlwaysOnTop(nextAlwaysOnTop);
      }

      await saveHudAlwaysOnTop(initialPreferences, nextAlwaysOnTop);
      setSaveState("saved");
    } catch {
      setAlwaysOnTop(previousAlwaysOnTop);
      setSaveState("error");
    }
  }
}

async function runWindowAction(action: (hudWindow: TauriWindow) => Promise<void>): Promise<void> {
  const hudWindow = await getCurrentHudWindow();

  if (hudWindow === null) {
    return;
  }

  await action(hudWindow);
}

async function getCurrentHudWindow(): Promise<TauriWindow | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");

    return getCurrentWindow() as TauriWindow;
  } catch {
    return null;
  }
}

async function saveHudAlwaysOnTop(
  initialPreferences: NotificationPreferences,
  alwaysOnTop: boolean,
): Promise<NotificationPreferences> {
  const preferences = await loadNotificationPreferences(initialPreferences);
  const session = await createLocalSession();
  const response = await fetch("/api/notification-preferences", {
    body: JSON.stringify({
      ...preferences,
      hud: {
        ...preferences.hud,
        alwaysOnTop,
      },
    }),
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-StackSpend-CSRF": session.csrfToken,
    },
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(`Save failed with status ${response.status}.`);
  }

  const payload = await response.json() as { preferences?: NotificationPreferences };

  if (payload.preferences === undefined) {
    throw new Error("Notification preferences payload is missing.");
  }

  return payload.preferences;
}

async function loadNotificationPreferences(fallback: NotificationPreferences): Promise<NotificationPreferences> {
  const response = await fetch("/api/notification-preferences", {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    return fallback;
  }

  const payload = await response.json() as { preferences?: NotificationPreferences };

  return payload.preferences ?? fallback;
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
