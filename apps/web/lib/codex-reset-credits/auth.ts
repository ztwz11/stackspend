import "server-only";

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { ResetCreditError } from "./errors";
import type { CodexAuth } from "./types";

const ACCESS_TOKEN_PATHS = [
  ["tokens", "access_token"],
  ["tokens", "accessToken"],
  ["access_token"],
  ["accessToken"],
] as const;
const ACCOUNT_ID_PATHS = [
  ["account", "id"],
  ["tokens", "account_id"],
  ["tokens", "accountId"],
  ["account_id"],
  ["accountId"],
  ["profile", "account_id"],
  ["profile", "accountId"],
] as const;

export interface ReadCodexAuthOptions {
  env?: Record<string, string | undefined>;
  homeDir?: string;
}

export async function readCodexAuth(options: ReadCodexAuthOptions = {}): Promise<CodexAuth> {
  const env = options.env ?? process.env;

  if (isKnownRemoteRuntime(env)) {
    throw new ResetCreditError(
      "LOCAL_CODEX_AUTH_UNAVAILABLE",
      "이 기능은 Codex가 설치된 동일한 컴퓨터의 로컬 Node.js 환경에서 실행해야 합니다.",
      400,
    );
  }

  const authFilePath = resolveCodexAuthFilePath(env, options.homeDir ?? homedir());
  const text = await readAuthFile(authFilePath);

  return parseCodexAuthJsonText(text);
}

export function resolveCodexAuthFilePath(
  env: Record<string, string | undefined> = process.env,
  homeDir = homedir(),
): string {
  const explicitFile = trimToNull(env.CODEX_AUTH_FILE);

  if (explicitFile !== null) {
    return explicitFile;
  }

  const codexHome = trimToNull(env.CODEX_HOME);

  return codexHome === null
    ? join(homeDir, ".codex", "auth.json")
    : join(codexHome, "auth.json");
}

export function parseCodexAuthJsonText(text: string): CodexAuth {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new ResetCreditError("AUTH_FILE_INVALID_JSON", "Codex 인증 파일이 올바른 JSON이 아닙니다.", 400);
  }

  const record = asRecord(parsed);

  if (record === null) {
    throw new ResetCreditError("AUTH_FILE_INVALID_JSON", "Codex 인증 파일이 JSON 객체가 아닙니다.", 400);
  }

  const accessToken = readFirstStringPath(record, ACCESS_TOKEN_PATHS);

  if (accessToken === null) {
    throw new ResetCreditError("ACCESS_TOKEN_NOT_FOUND", "Codex 인증 파일에서 access token을 찾지 못했습니다. 터미널에서 `codex login`을 실행한 후 다시 시도하세요.", 400);
  }

  const accountId = readFirstStringPath(record, ACCOUNT_ID_PATHS);

  if (accountId === null) {
    throw new ResetCreditError("ACCOUNT_ID_NOT_FOUND", "Codex 인증 파일에서 account ID를 찾지 못했습니다. 터미널에서 `codex login`을 실행한 후 다시 시도하세요.", 400);
  }

  return {
    accessToken,
    accountId,
  };
}

async function readAuthFile(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (caught) {
    const code = typeof caught === "object" && caught !== null && "code" in caught
      ? String((caught as { code?: unknown }).code)
      : "";

    if (code === "ENOENT") {
      throw new ResetCreditError("AUTH_FILE_NOT_FOUND", "Codex 인증 파일을 찾지 못했습니다. 터미널에서 `codex login`을 실행한 후 다시 시도하세요.", 400);
    }

    if (code === "EACCES" || code === "EPERM") {
      throw new ResetCreditError("AUTH_FILE_PERMISSION_DENIED", "Codex 인증 파일을 읽을 권한이 없습니다.", 403);
    }

    throw new ResetCreditError("AUTH_FILE_NOT_FOUND", "Codex 인증 파일을 읽지 못했습니다.", 400);
  }
}

function readFirstStringPath(
  record: Record<string, unknown>,
  paths: readonly (readonly string[])[],
): string | null {
  for (const path of paths) {
    const value = readPath(record, path);
    const stringValue = typeof value === "string" ? trimToNull(value) : null;

    if (stringValue !== null) {
      return stringValue;
    }
  }

  return null;
}

function readPath(record: Record<string, unknown>, path: readonly string[]): unknown {
  let current: unknown = record;

  for (const segment of path) {
    const currentRecord = asRecord(current);

    if (currentRecord === null) {
      return undefined;
    }

    current = currentRecord[segment];
  }

  return current;
}

function isKnownRemoteRuntime(env: Record<string, string | undefined>): boolean {
  return trimToNull(env.VERCEL) !== null ||
    trimToNull(env.NETLIFY) !== null ||
    trimToNull(env.AWS_LAMBDA_FUNCTION_NAME) !== null ||
    trimToNull(env.LAMBDA_TASK_ROOT) !== null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";

  return trimmed.length === 0 ? null : trimmed;
}
