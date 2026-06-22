export interface UsageProgressView {
  usedPercent: number | null;
  remainingPercent: number | null;
  warningAtPercent: number;
  criticalAtPercent: number;
}

export type UsageProgressSeverity = "info" | "warning" | "critical";

const DEFAULT_WARNING_AT_PERCENT = 80;
const DEFAULT_CRITICAL_AT_PERCENT = 95;

export function usageProgressFromUsedPercent(
  value: number | null | undefined,
  thresholds: {
    warningAtPercent?: number;
    criticalAtPercent?: number;
  } = {},
): UsageProgressView {
  const usedPercent = normalizePercent(value);
  const warningAtPercent = thresholds.warningAtPercent ?? DEFAULT_WARNING_AT_PERCENT;
  const criticalAtPercent = thresholds.criticalAtPercent ?? DEFAULT_CRITICAL_AT_PERCENT;

  return {
    usedPercent,
    remainingPercent: usedPercent === null ? null : clampPercent(100 - usedPercent),
    warningAtPercent,
    criticalAtPercent,
  };
}

export function usageProgressFromRemainingPercent(
  value: number | null | undefined,
  thresholds: {
    warningAtPercent?: number;
    criticalAtPercent?: number;
  } = {},
): UsageProgressView {
  const remainingPercent = normalizePercent(value);
  const warningAtPercent = thresholds.warningAtPercent ?? DEFAULT_WARNING_AT_PERCENT;
  const criticalAtPercent = thresholds.criticalAtPercent ?? DEFAULT_CRITICAL_AT_PERCENT;

  return {
    usedPercent: remainingPercent === null ? null : clampPercent(100 - remainingPercent),
    remainingPercent,
    warningAtPercent,
    criticalAtPercent,
  };
}

export function usageProgressFromTokens(
  usedTokens: number | null | undefined,
  remainingTokens: number | null | undefined,
  thresholds: {
    warningAtPercent?: number;
    criticalAtPercent?: number;
  } = {},
): UsageProgressView {
  const used = normalizeNonNegativeNumber(usedTokens);
  const remaining = normalizeNonNegativeNumber(remainingTokens);

  if (used === null || remaining === null) {
    return usageProgressFromUsedPercent(null, thresholds);
  }

  const total = used + remaining;

  return usageProgressFromUsedPercent(total <= 0 ? null : (used / total) * 100, thresholds);
}

export function usageProgressSeverity(progress: UsageProgressView): UsageProgressSeverity {
  if (progress.usedPercent === null) {
    return "info";
  }

  if (progress.usedPercent >= progress.criticalAtPercent) {
    return "critical";
  }

  if (progress.usedPercent >= progress.warningAtPercent) {
    return "warning";
  }

  return "info";
}

export function normalizePercent(value: number | null | undefined): number | null {
  return value === null || value === undefined || !Number.isFinite(value)
    ? null
    : clampPercent(value);
}

function normalizeNonNegativeNumber(value: number | null | undefined): number | null {
  return value === null || value === undefined || !Number.isFinite(value) || value < 0 ? null : value;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}
