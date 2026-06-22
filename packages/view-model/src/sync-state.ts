export type AggregateSyncStatus = "ok" | "partial" | "stale" | "error" | "empty";

export type RiskSeverity = "info" | "warning" | "critical";

export type SyncStateValue =
  | "fresh"
  | "stale"
  | "error"
  | "not_configured"
  | "unavailable"
  | "locked";

export type SyncErrorCode =
  | "not_configured"
  | "auth_expired"
  | "permission_denied"
  | "rate_limited"
  | "timeout"
  | "network"
  | "upstream_unavailable"
  | "schema_changed"
  | "invalid_data"
  | "local_source_missing"
  | "local_io"
  | "internal";

export interface SyncErrorView {
  code: SyncErrorCode;
  retryable: boolean;
  userActionRequired: boolean;
  message: string;
}

export interface ItemSyncView {
  state: SyncStateValue;
  observedAt: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  freshUntil: string | null;
  staleUntil: string | null;
  ageSeconds: number | null;
  source: string;
  error: SyncErrorView | null;
  lastRefreshFailed: boolean;
}

export function createSyncError(code: SyncErrorCode, message?: string): SyncErrorView {
  return {
    code,
    retryable: isRetryableSyncError(code),
    userActionRequired: isUserActionRequiredSyncError(code),
    message: sanitizeSyncMessage(message ?? defaultSyncErrorMessage(code)),
  };
}

export function syncViewFromFreshness(options: {
  freshness: "live" | "stale" | "error" | "unavailable" | "not_configured" | "locked";
  checkedAt: string | null;
  generatedAt: string;
  ttlSeconds?: number | null;
  source: string;
  message?: string | null;
  lastAttemptAt?: string | null;
  lastSuccessAt?: string | null;
  freshUntil?: string | null;
  staleUntil?: string | null;
  lastRefreshFailed?: boolean;
}): ItemSyncView {
  const state = syncStateFromFreshness(options.freshness);
  const observedAt = options.checkedAt;
  const ageSeconds = observedAt === null
    ? null
    : Math.max(0, Math.floor((Date.parse(options.generatedAt) - Date.parse(observedAt)) / 1000));
  const defaultFreshUntil = observedAt === null || options.ttlSeconds === null || options.ttlSeconds === undefined
    ? null
    : new Date(Date.parse(observedAt) + options.ttlSeconds * 1000).toISOString();

  return {
    state,
    observedAt,
    lastAttemptAt: options.lastAttemptAt ?? observedAt,
    lastSuccessAt: options.lastSuccessAt ?? (state === "error" ? null : observedAt),
    freshUntil: options.freshUntil ?? defaultFreshUntil,
    staleUntil: options.staleUntil ?? null,
    ageSeconds: Number.isFinite(ageSeconds) ? ageSeconds : null,
    source: options.source,
    error: state === "error" || state === "locked" || state === "not_configured"
      ? createSyncError(errorCodeFromState(state, options.message), options.message ?? undefined)
      : null,
    lastRefreshFailed: options.lastRefreshFailed ?? state === "error",
  };
}

export function summarizeAggregateSync(items: readonly ItemSyncView[]): {
  status: AggregateSyncStatus;
  freshCount: number;
  staleCount: number;
  errorCount: number;
  neutralCount: number;
  lastSuccessAt: string | null;
} {
  const actionable = items.filter((item) => !isNeutralSyncState(item.state));
  const freshCount = actionable.filter((item) => item.state === "fresh").length;
  const staleCount = actionable.filter((item) => item.state === "stale").length;
  const errorCount = actionable.filter((item) => item.state === "error" || item.state === "locked").length;
  const neutralCount = items.length - actionable.length;
  const lastSuccessAt = latestIso(items.map((item) => item.lastSuccessAt).filter((value): value is string => value !== null));
  const status = actionable.length === 0
    ? "empty"
    : errorCount > 0 && (freshCount > 0 || staleCount > 0)
      ? "partial"
      : errorCount === actionable.length
        ? "error"
        : freshCount > 0 && staleCount > 0
          ? "partial"
          : staleCount === actionable.length
            ? "stale"
            : "ok";

  return {
    status,
    freshCount,
    staleCount,
    errorCount,
    neutralCount,
    lastSuccessAt,
  };
}

export function syncStateFromFreshness(
  freshness: "live" | "stale" | "error" | "unavailable" | "not_configured" | "locked",
): SyncStateValue {
  if (freshness === "live") {
    return "fresh";
  }

  if (freshness === "not_configured" || freshness === "unavailable" || freshness === "locked") {
    return freshness;
  }

  return freshness;
}

export function isNeutralSyncState(state: SyncStateValue): boolean {
  return state === "not_configured" || state === "unavailable";
}

function errorCodeFromState(state: SyncStateValue, message: string | null | undefined): SyncErrorCode {
  if (state === "not_configured") {
    return "not_configured";
  }

  if (state === "locked") {
    return "local_io";
  }

  if (message !== undefined && message !== null) {
    const normalized = message.toLowerCase();

    if (normalized.includes("permission") || normalized.includes("403")) {
      return "permission_denied";
    }

    if (normalized.includes("401") || normalized.includes("expired")) {
      return "auth_expired";
    }

    if (normalized.includes("429") || normalized.includes("rate limit")) {
      return "rate_limited";
    }

    if (normalized.includes("timeout")) {
      return "timeout";
    }

    if (normalized.includes("network") || normalized.includes("enotfound") || normalized.includes("econn")) {
      return "network";
    }
  }

  return "internal";
}

function isRetryableSyncError(code: SyncErrorCode): boolean {
  return code === "rate_limited" || code === "timeout" || code === "network" || code === "upstream_unavailable";
}

function isUserActionRequiredSyncError(code: SyncErrorCode): boolean {
  return code === "not_configured" ||
    code === "auth_expired" ||
    code === "permission_denied" ||
    code === "local_source_missing" ||
    code === "local_io";
}

function defaultSyncErrorMessage(code: SyncErrorCode): string {
  if (code === "auth_expired") {
    return "Login may have expired. Sign in again and retry.";
  }

  if (code === "permission_denied") {
    return "Permission is not sufficient for this read-only check.";
  }

  if (code === "not_configured" || code === "local_source_missing") {
    return "Local source or credential is not configured.";
  }

  if (code === "rate_limited") {
    return "Provider request limit was reached. Retry later.";
  }

  if (code === "schema_changed") {
    return "Provider response shape changed.";
  }

  return "Live sync failed.";
}

function sanitizeSyncMessage(value: string): string {
  return value
    .replace(/https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g, "[redacted]")
    .replace(/\b(?:sk|sbp|xox[baprs])[-_][A-Za-z0-9_-]+\b/gi, "[redacted]")
    .replace(/\bacct[_-][A-Za-z0-9_-]+\b/gi, "[redacted]")
    .replace(/\b(?:proj|project|invoice)[_-][A-Za-z0-9_-]+\b/gi, "[redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]");
}

function latestIso(values: readonly string[]): string | null {
  return values.length === 0
    ? null
    : [...values].sort((first, second) => second.localeCompare(first))[0] ?? null;
}
