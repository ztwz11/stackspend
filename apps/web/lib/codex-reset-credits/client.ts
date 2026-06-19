import "server-only";

import { ResetCreditError } from "./errors";
import { readCodexAuth } from "./auth";
import { hasResetCreditResponseShape, normalizeResetCreditStatus } from "./normalize";
import type { CodexAuth, ResetCreditStatus } from "./types";

const DEFAULT_ENDPOINT = "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";
const DEFAULT_TIMEOUT_MS = 15_000;
const USER_AGENT = "codex-reset-credit-nextjs/1.0";

export interface FetchCodexResetCreditsOptions {
  env?: Record<string, string | undefined>;
  now?: () => Date;
  fetchImpl?: typeof fetch;
  auth?: CodexAuth;
}

export async function fetchCodexResetCreditStatus(
  options: FetchCodexResetCreditsOptions = {},
): Promise<ResetCreditStatus> {
  const env = options.env ?? process.env;
  const now = options.now ?? (() => new Date());
  const auth = options.auth ?? await readCodexAuth({ env });
  const endpoint = trimToNull(env.CODEX_RESET_CREDIT_ENDPOINT) ?? DEFAULT_ENDPOINT;
  const timeoutMs = readTimeoutMs(env.CODEX_API_TIMEOUT_MS);
  const fetchImpl = options.fetchImpl ?? fetch;

  return await requestWithRetry(endpoint, auth, {
    fetchImpl,
    timeoutMs,
    now,
  });
}

async function requestWithRetry(
  endpoint: string,
  auth: CodexAuth,
  options: {
    fetchImpl: typeof fetch;
    timeoutMs: number;
    now: () => Date;
  },
): Promise<ResetCreditStatus> {
  let lastError: ResetCreditError | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await requestOnce(endpoint, auth, options);
    } catch (caught) {
      const error = caught instanceof ResetCreditError
        ? caught
        : new ResetCreditError("UPSTREAM_UNAVAILABLE", "Codex 초기화권 API에 연결하지 못했습니다.", 502);

      lastError = error;

      if (attempt >= 1 || !isRetryable(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new ResetCreditError("UPSTREAM_UNAVAILABLE", "Codex 초기화권 API에 연결하지 못했습니다.", 502);
}

async function requestOnce(
  endpoint: string,
  auth: CodexAuth,
  options: {
    fetchImpl: typeof fetch;
    timeoutMs: number;
    now: () => Date;
  },
): Promise<ResetCreditStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  let response: Response;

  try {
    response = await options.fetchImpl(endpoint, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
        "OpenAI-Account": auth.accountId,
        "User-Agent": USER_AGENT,
      },
      method: "GET",
      signal: controller.signal,
    });
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") {
      throw new ResetCreditError("UPSTREAM_TIMEOUT", "Codex 초기화권 API 요청 시간이 초과됐습니다.", 504);
    }

    throw new ResetCreditError("UPSTREAM_UNAVAILABLE", "Codex 초기화권 API에 연결하지 못했습니다.", 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw httpError(response.status);
  }

  let payload: unknown;

  try {
    payload = await response.json() as unknown;
  } catch {
    throw new ResetCreditError("UPSTREAM_INVALID_JSON", "Codex 초기화권 API 응답이 올바른 JSON이 아닙니다.", 502);
  }

  if (!isJsonObject(payload)) {
    throw new ResetCreditError("UPSTREAM_INVALID_RESPONSE", "Codex 초기화권 API 응답 구조가 예상과 다릅니다.", 502);
  }

  if (!hasResetCreditResponseShape(payload)) {
    throw new ResetCreditError("UPSTREAM_INVALID_RESPONSE", "Codex 초기화권 API 응답 구조가 예상과 다릅니다.", 502);
  }

  return normalizeResetCreditStatus(payload, options.now());
}

function httpError(status: number): ResetCreditError {
  if (status === 401) {
    return new ResetCreditError(
      "UPSTREAM_UNAUTHORIZED",
      "Codex 로그인 토큰이 만료됐을 수 있습니다. 터미널에서 `codex login`을 실행한 후 다시 시도하세요.",
      401,
    );
  }

  if (status === 403) {
    return new ResetCreditError("UPSTREAM_FORBIDDEN", "Codex 초기화권 API 접근 권한이 없습니다.", 403);
  }

  if (status === 429) {
    return new ResetCreditError("UPSTREAM_RATE_LIMITED", "Codex 초기화권 API 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.", 429);
  }

  if (status >= 500 && status <= 599) {
    return new ResetCreditError("UPSTREAM_UNAVAILABLE", "Codex 초기화권 API가 일시적으로 응답하지 않습니다.", 502);
  }

  return new ResetCreditError("UPSTREAM_INVALID_RESPONSE", "Codex 초기화권 API 응답 상태가 예상과 다릅니다.", 502);
}

function isRetryable(error: ResetCreditError): boolean {
  return error.code === "UPSTREAM_UNAVAILABLE";
}

function readTimeoutMs(value: string | undefined): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 1000 ? Math.floor(parsed) : DEFAULT_TIMEOUT_MS;
}

function isJsonObject(value: unknown): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";

  return trimmed.length === 0 ? null : trimmed;
}
