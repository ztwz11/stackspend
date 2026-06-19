import "server-only";

import type { CreditAlert } from "../codex-reset-credits/types";
import type { ResetCreditNotifier } from "./types";

const TELEGRAM_API_BASE = "https://api.telegram.org";

export class TelegramResetCreditNotifier implements ResetCreditNotifier {
  private readonly botToken: string;
  private readonly chatId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: {
    botToken: string;
    chatId: string;
    fetchImpl?: typeof fetch;
  }) {
    this.botToken = options.botToken;
    this.chatId = options.chatId;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(alert: CreditAlert): Promise<void> {
    const response = await this.fetchImpl(`${TELEGRAM_API_BASE}/bot${this.botToken}/sendMessage`, {
      body: JSON.stringify({
        chat_id: this.chatId,
        text: alert.message,
      }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Telegram reset credit notification failed.");
    }
  }
}

export function telegramNotifierFromEnv(
  env: Record<string, string | undefined> = process.env,
): TelegramResetCreditNotifier | null {
  const botToken = trimToNull(env.TELEGRAM_BOT_TOKEN);
  const chatId = trimToNull(env.TELEGRAM_CHAT_ID);

  return botToken === null || chatId === null
    ? null
    : new TelegramResetCreditNotifier({ botToken, chatId });
}

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";

  return trimmed.length === 0 ? null : trimmed;
}
