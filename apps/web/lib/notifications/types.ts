import type { CreditAlert } from "../codex-reset-credits/types";

export interface ResetCreditNotifier {
  send(alert: CreditAlert): Promise<void>;
}
