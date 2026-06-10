export const TRAY_ACTION_IDS = [
  "open-dashboard",
  "open-today-live",
  "open-connections",
  "refresh-now",
  "pause-30m",
  "pause-1h",
  "pause-until-tomorrow",
  "start-at-login-toggle",
  "run-doctor",
  "quit",
] as const;

export type TrayActionId = typeof TRAY_ACTION_IDS[number];

export type TrayActionKind =
  | "navigation"
  | "refresh"
  | "pause"
  | "preference"
  | "diagnostic"
  | "quit";

export type TrayActionIntent =
  | "open_url"
  | "refresh_live"
  | "pause_notifications"
  | "toggle_start_at_login"
  | "run_local_doctor"
  | "quit";

export interface TrayAction {
  id: TrayActionId;
  label: string;
  kind: TrayActionKind;
  intent: TrayActionIntent;
  enabled: boolean;
  urlPath?: string;
  durationMinutes?: number;
}

export interface TrayActionBuildOptions {
  locale?: "ko" | "en" | "ja";
  startAtLoginEnabled?: boolean;
}

export const DEFAULT_TRAY_ACTIONS: readonly TrayAction[] = [
  {
    id: "open-dashboard",
    label: "Open Dashboard",
    kind: "navigation",
    intent: "open_url",
    enabled: true,
    urlPath: "/ko/dashboard/overview",
  },
  {
    id: "open-today-live",
    label: "Open Today Live",
    kind: "navigation",
    intent: "open_url",
    enabled: true,
    urlPath: "/ko/dashboard/today-live",
  },
  {
    id: "open-connections",
    label: "Open Connections",
    kind: "navigation",
    intent: "open_url",
    enabled: true,
    urlPath: "/ko/settings/connections",
  },
  {
    id: "refresh-now",
    label: "Refresh Now",
    kind: "refresh",
    intent: "refresh_live",
    enabled: true,
  },
  {
    id: "pause-30m",
    label: "Pause Notifications 30m",
    kind: "pause",
    intent: "pause_notifications",
    enabled: true,
    durationMinutes: 30,
  },
  {
    id: "pause-1h",
    label: "Pause Notifications 1h",
    kind: "pause",
    intent: "pause_notifications",
    enabled: true,
    durationMinutes: 60,
  },
  {
    id: "pause-until-tomorrow",
    label: "Pause Until Tomorrow",
    kind: "pause",
    intent: "pause_notifications",
    enabled: true,
  },
  {
    id: "start-at-login-toggle",
    label: "Start at Login",
    kind: "preference",
    intent: "toggle_start_at_login",
    enabled: true,
  },
  {
    id: "run-doctor",
    label: "Run Doctor",
    kind: "diagnostic",
    intent: "run_local_doctor",
    enabled: true,
  },
  {
    id: "quit",
    label: "Quit StackSpend",
    kind: "quit",
    intent: "quit",
    enabled: true,
  },
];

export function buildTrayActions(options: TrayActionBuildOptions = {}): readonly TrayAction[] {
  const locale = options.locale ?? "ko";

  return DEFAULT_TRAY_ACTIONS.map((action) => {
    if (action.kind !== "navigation" || action.urlPath === undefined) {
      if (action.id !== "start-at-login-toggle") {
        return { ...action };
      }

      return {
        ...action,
        label: options.startAtLoginEnabled === true ? "Start at Login: On" : "Start at Login: Off",
      };
    }

    return {
      ...action,
      urlPath: localizePath(action.urlPath, locale),
    };
  });
}

export function isTrayActionId(value: string): value is TrayActionId {
  return (TRAY_ACTION_IDS as readonly string[]).includes(value);
}

function localizePath(path: string, locale: "ko" | "en" | "ja"): string {
  return path.replace(/^\/(?:ko|en|ja)\//, `/${locale}/`);
}
