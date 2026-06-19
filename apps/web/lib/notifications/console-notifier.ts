import "server-only";

import type { CreditAlert } from "../codex-reset-credits/types";
import type { ResetCreditNotifier } from "./types";

export class ConsoleResetCreditNotifier implements ResetCreditNotifier {
  async send(alert: CreditAlert): Promise<void> {
    console.info("[moneysiren] codex reset credit alert", {
      threshold: alert.threshold,
      expiresAtUtc: alert.expiresAtUtc,
      message: alert.message,
    });
  }
}
