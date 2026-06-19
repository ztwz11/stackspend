import type { AlertThreshold } from "../codex-reset-credits/types";

export interface AlertHistoryRepository {
  hasSent(creditKey: string, threshold: AlertThreshold): Promise<boolean>;
  markSent(creditKey: string, threshold: AlertThreshold): Promise<void>;
}
