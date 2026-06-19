import "server-only";

import { FileAlertHistoryRepository } from "../alert-history/file-repository";
import type { AlertHistoryRepository } from "../alert-history/repository";
import { buildResetCreditAlerts } from "../codex-reset-credits/expiry";
import type { ResetCreditStatus } from "../codex-reset-credits/types";
import { ConsoleResetCreditNotifier } from "./console-notifier";
import { telegramNotifierFromEnv } from "./telegram-notifier";
import type { ResetCreditNotifier } from "./types";

export interface ResetCreditAlertResult {
  checked: number;
  notificationsSent: number;
  skippedDuplicates: number;
}

export async function runResetCreditAlerts(
  status: ResetCreditStatus,
  options: {
    now?: Date;
    repository?: AlertHistoryRepository;
    notifier?: ResetCreditNotifier;
    env?: Record<string, string | undefined>;
  } = {},
): Promise<ResetCreditAlertResult> {
  const repository = options.repository ?? new FileAlertHistoryRepository();
  const notifier = options.notifier ?? createResetCreditNotifier(options.env ?? process.env);
  const alerts = buildResetCreditAlerts(status, options.now ?? new Date());
  let notificationsSent = 0;
  let skippedDuplicates = 0;

  for (const alert of alerts) {
    if (await repository.hasSent(alert.creditKey, alert.threshold)) {
      skippedDuplicates += 1;
      continue;
    }

    await notifier.send(alert);
    await repository.markSent(alert.creditKey, alert.threshold);
    notificationsSent += 1;
  }

  return {
    checked: status.credits.length,
    notificationsSent,
    skippedDuplicates,
  };
}

export function createResetCreditNotifier(
  env: Record<string, string | undefined>,
): ResetCreditNotifier {
  return telegramNotifierFromEnv(env) ?? new ConsoleResetCreditNotifier();
}
