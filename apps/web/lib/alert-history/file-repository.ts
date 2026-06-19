import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AlertThreshold } from "../codex-reset-credits/types";
import type { AlertHistoryRepository } from "./repository";

interface AlertHistoryFile {
  version: 1;
  updatedAtUtc: string;
  sent: Record<string, AlertThreshold[]>;
}

const DEFAULT_HISTORY_FILE = "codex-reset-credit-alert-history.json";

export class FileAlertHistoryRepository implements AlertHistoryRepository {
  private readonly path: string;

  constructor(path: string = defaultHistoryPath(process.env)) {
    this.path = path;
  }

  async hasSent(creditKey: string, threshold: AlertThreshold): Promise<boolean> {
    const history = await this.read();

    return history.sent[creditKey]?.includes(threshold) ?? false;
  }

  async markSent(creditKey: string, threshold: AlertThreshold): Promise<void> {
    const history = await this.read();
    const thresholds = new Set(history.sent[creditKey] ?? []);
    thresholds.add(threshold);
    const next: AlertHistoryFile = {
      version: 1,
      updatedAtUtc: new Date().toISOString(),
      sent: {
        ...history.sent,
        [creditKey]: [...thresholds],
      },
    };

    await writeAtomicJson(this.path, next);
  }

  private async read(): Promise<AlertHistoryFile> {
    try {
      return parseAlertHistory(JSON.parse(await readFile(this.path, "utf8")) as unknown);
    } catch {
      return emptyAlertHistory();
    }
  }
}

export function defaultHistoryPath(env: Record<string, string | undefined>): string {
  return trimToNull(env.MONEYSIREN_CODEX_RESET_CREDIT_ALERT_HISTORY_PATH) ??
    join(process.cwd(), ".moneysiren", DEFAULT_HISTORY_FILE);
}

function parseAlertHistory(value: unknown): AlertHistoryFile {
  const record = asRecord(value);

  if (record === null) {
    return emptyAlertHistory();
  }

  return {
    version: 1,
    updatedAtUtc: typeof record.updatedAtUtc === "string" ? record.updatedAtUtc : new Date(0).toISOString(),
    sent: parseSent(record.sent),
  };
}

function parseSent(value: unknown): Record<string, AlertThreshold[]> {
  const record = asRecord(value);
  const sent: Record<string, AlertThreshold[]> = {};

  if (record === null) {
    return sent;
  }

  for (const [creditKey, thresholds] of Object.entries(record)) {
    if (!Array.isArray(thresholds)) {
      continue;
    }

    const parsedThresholds = thresholds.filter(isAlertThreshold);

    if (parsedThresholds.length > 0) {
      sent[creditKey] = parsedThresholds;
    }
  }

  return sent;
}

function isAlertThreshold(value: unknown): value is AlertThreshold {
  return value === "7d" || value === "3d" || value === "1d" || value === "6h" || value === "expired";
}

async function writeAtomicJson(path: string, value: AlertHistoryFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, path);
}

function emptyAlertHistory(): AlertHistoryFile {
  return {
    version: 1,
    updatedAtUtc: new Date(0).toISOString(),
    sent: {},
  };
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
