export const RESET_CREDIT_TIME_ZONE = "Asia/Seoul";
export const RESET_CREDIT_SOURCE = "chatgpt-internal-api";
export const RESET_CREDIT_UNOFFICIAL = true;

export type ResetCreditStatusValue = "active" | "expiring-soon" | "expired" | "unknown";

export interface ResetCreditStatus {
  fetchedAtUtc: string;
  availableCount: number | null;
  totalEarnedCount: number | null;
  credits: readonly ResetCredit[];
}

export interface ResetCredit {
  index: number;
  expiresAtUtc: string | null;
  remainingSeconds: number | null;
  status: ResetCreditStatusValue;
}

export type ResetCreditErrorCode =
  | "LOCAL_CODEX_AUTH_UNAVAILABLE"
  | "AUTH_FILE_NOT_FOUND"
  | "AUTH_FILE_PERMISSION_DENIED"
  | "AUTH_FILE_INVALID_JSON"
  | "ACCESS_TOKEN_NOT_FOUND"
  | "ACCOUNT_ID_NOT_FOUND"
  | "UPSTREAM_UNAUTHORIZED"
  | "UPSTREAM_FORBIDDEN"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_INVALID_JSON"
  | "UPSTREAM_INVALID_RESPONSE"
  | "API_UNAUTHORIZED"
  | "CRON_SECRET_NOT_CONFIGURED";

export interface ResetCreditApiSuccess {
  ok: true;
  data: ResetCreditStatus;
  meta: ResetCreditResponseMeta;
}

export interface ResetCreditApiFailure {
  ok: false;
  error: {
    code: ResetCreditErrorCode;
    message: string;
  };
}

export type ResetCreditApiResponse = ResetCreditApiSuccess | ResetCreditApiFailure;

export interface ResetCreditResponseMeta {
  timeZone: typeof RESET_CREDIT_TIME_ZONE;
  source: typeof RESET_CREDIT_SOURCE;
  unofficial: true;
}

export type AlertThreshold = "7d" | "3d" | "1d" | "6h" | "expired";

export interface CreditAlert {
  creditKey: string;
  threshold: AlertThreshold;
  expiresAtUtc: string;
  message: string;
}

export interface CodexAuth {
  accessToken: string;
  accountId: string;
}
