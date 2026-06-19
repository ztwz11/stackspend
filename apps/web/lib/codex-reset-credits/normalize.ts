import type { ResetCreditStatus, ResetCreditStatusValue } from "./types";

const AVAILABLE_COUNT_KEYS = [
  "available_reset_credits",
  "availableResetCredits",
  "available_count",
  "availableCount",
  "available",
] as const;
const TOTAL_EARNED_COUNT_KEYS = [
  "total_earned_count",
  "totalEarnedCount",
  "total_earned",
] as const;
const CREDITS_KEYS = [
  "reset_credits",
  "resetCredits",
  "credits",
  "items",
] as const;
const EXPIRES_AT_KEYS = [
  "expires_at",
  "expiresAt",
  "expiration_time",
  "expirationTime",
] as const;
const EXPIRING_SOON_SECONDS = 7 * 24 * 60 * 60;

export function normalizeResetCreditStatus(value: unknown, now: Date = new Date()): ResetCreditStatus {
  const record = asRecord(value);

  if (record === null) {
    return emptyResetCreditStatus(now);
  }

  const fetchedAtUtc = now.toISOString();
  const availableCount = readNonNegativeIntegerAlias(record, AVAILABLE_COUNT_KEYS);
  const totalEarnedCount = readNonNegativeIntegerAlias(record, TOTAL_EARNED_COUNT_KEYS);
  const creditsValue = readAlias(record, CREDITS_KEYS);
  const credits = Array.isArray(creditsValue)
    ? normalizeCredits(creditsValue, now)
    : [];

  return {
    fetchedAtUtc,
    availableCount,
    totalEarnedCount,
    credits,
  };
}

export function hasResetCreditResponseShape(value: unknown): boolean {
  const record = asRecord(value);

  if (record === null) {
    return false;
  }

  return [
    ...AVAILABLE_COUNT_KEYS,
    ...TOTAL_EARNED_COUNT_KEYS,
    ...CREDITS_KEYS,
  ].some((key) => Object.prototype.hasOwnProperty.call(record, key));
}

function emptyResetCreditStatus(now: Date): ResetCreditStatus {
  return {
    fetchedAtUtc: now.toISOString(),
    availableCount: null,
    totalEarnedCount: null,
    credits: [],
  };
}

function normalizeCredits(values: readonly unknown[], now: Date): ResetCreditStatus["credits"] {
  return values
    .map((value) => normalizeCredit(value, now))
    .sort(compareCredits)
    .map((credit, index) => ({
      ...credit,
      index: index + 1,
    }));
}

function normalizeCredit(value: unknown, now: Date): ResetCreditStatus["credits"][number] {
  const record = asRecord(value);
  const expiresAtUtc = record === null ? null : normalizeExpiry(readAlias(record, EXPIRES_AT_KEYS));
  const remainingSeconds = expiresAtUtc === null ? null : Math.max(0, Math.floor((Date.parse(expiresAtUtc) - now.getTime()) / 1000));

  return {
    index: 0,
    expiresAtUtc,
    remainingSeconds,
    status: statusForExpiry(expiresAtUtc, now),
  };
}

function compareCredits(left: ResetCreditStatus["credits"][number], right: ResetCreditStatus["credits"][number]): number {
  if (left.expiresAtUtc === null && right.expiresAtUtc === null) {
    return 0;
  }

  if (left.expiresAtUtc === null) {
    return 1;
  }

  if (right.expiresAtUtc === null) {
    return -1;
  }

  return Date.parse(left.expiresAtUtc) - Date.parse(right.expiresAtUtc);
}

function statusForExpiry(expiresAtUtc: string | null, now: Date): ResetCreditStatusValue {
  if (expiresAtUtc === null) {
    return "unknown";
  }

  const remainingSeconds = Math.floor((Date.parse(expiresAtUtc) - now.getTime()) / 1000);

  if (remainingSeconds <= 0) {
    return "expired";
  }

  if (remainingSeconds <= EXPIRING_SOON_SECONDS) {
    return "expiring-soon";
  }

  return "active";
}

function normalizeExpiry(value: unknown): string | null {
  if (typeof value === "string") {
    const parsed = Date.parse(value);

    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    const parsed = new Date(millis);

    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

function readNonNegativeIntegerAlias(
  record: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  const value = readAlias(record, keys);

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.floor(value);
}

function readAlias(record: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key];
    }
  }

  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
