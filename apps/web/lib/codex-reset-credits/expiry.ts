import { createHash } from "node:crypto";
import {
  RESET_CREDIT_TIME_ZONE,
  type AlertThreshold,
  type CreditAlert,
  type ResetCreditStatus,
} from "./types";

const THRESHOLD_SECONDS: Readonly<Record<Exclude<AlertThreshold, "expired">, number>> = {
  "7d": 7 * 24 * 60 * 60,
  "3d": 3 * 24 * 60 * 60,
  "1d": 24 * 60 * 60,
  "6h": 6 * 60 * 60,
};

export function buildResetCreditAlerts(status: ResetCreditStatus, now: Date = new Date()): CreditAlert[] {
  return status.credits.flatMap((credit) => {
    if (credit.expiresAtUtc === null) {
      return [];
    }

    const expiresAtMs = Date.parse(credit.expiresAtUtc);

    if (Number.isNaN(expiresAtMs)) {
      return [];
    }

    const remainingSeconds = Math.floor((expiresAtMs - now.getTime()) / 1000);
    const thresholds: AlertThreshold[] = remainingSeconds <= 0
      ? ["expired"]
      : (Object.entries(THRESHOLD_SECONDS) as Array<[Exclude<AlertThreshold, "expired">, number]>)
        .filter(([, seconds]) => remainingSeconds <= seconds)
        .map(([threshold]) => threshold);
    const creditKey = creditKeyFromExpiresAt(credit.expiresAtUtc);

    return thresholds.map((threshold) => ({
      creditKey,
      threshold,
      expiresAtUtc: credit.expiresAtUtc ?? "",
      message: buildAlertMessage(threshold, credit.expiresAtUtc ?? ""),
    }));
  });
}

export function creditKeyFromExpiresAt(expiresAtUtc: string): string {
  return createHash("sha256").update(new Date(expiresAtUtc).toISOString()).digest("hex");
}

export function buildAlertMessage(threshold: AlertThreshold, expiresAtUtc: string): string {
  const label = threshold === "expired"
    ? "이미 만료됐습니다."
    : `${thresholdLabel(threshold)} 이내에 만료됩니다.`;

  return `Codex 초기화권 1개가 ${label}\n만료 예정: ${formatSeoulDateTime(expiresAtUtc)} (${RESET_CREDIT_TIME_ZONE})`;
}

export function formatSeoulDateTime(expiresAtUtc: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: RESET_CREDIT_TIME_ZONE,
  }).format(new Date(expiresAtUtc));
}

function thresholdLabel(threshold: AlertThreshold): string {
  switch (threshold) {
    case "7d":
      return "7일";
    case "3d":
      return "3일";
    case "1d":
      return "1일";
    case "6h":
      return "6시간";
    case "expired":
      return "만료";
  }
}
