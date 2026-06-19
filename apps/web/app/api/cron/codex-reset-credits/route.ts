import { timingSafeEqual } from "node:crypto";
import {
  fetchCodexResetCreditStatus,
  toResetCreditError,
} from "../../../../lib/codex-reset-credits";
import { ResetCreditError } from "../../../../lib/codex-reset-credits/errors";
import { runResetCreditAlerts } from "../../../../lib/notifications/alert-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
};

export async function POST(request: Request): Promise<Response> {
  try {
    requireCronSecret(request, process.env);
    const status = await fetchCodexResetCreditStatus();
    const result = await runResetCreditAlerts(status);

    return Response.json({
      ok: true,
      checked: result.checked,
      notificationsSent: result.notificationsSent,
      skippedDuplicates: result.skippedDuplicates,
    }, {
      headers: NO_STORE_HEADERS,
    });
  } catch (caught) {
    const error = toResetCreditError(caught);

    return Response.json({
      ok: false,
      error: {
        code: error.code,
        message: error.message,
      },
    }, {
      status: error.status,
      headers: NO_STORE_HEADERS,
    });
  }
}

export function requireCronSecret(
  request: Request,
  env: Record<string, string | undefined>,
): void {
  const expected = trimToNull(env.CRON_SECRET);

  if (expected === null) {
    throw new ResetCreditError("CRON_SECRET_NOT_CONFIGURED", "CRON_SECRET must be set before running reset credit notifications.", 500);
  }

  const header = request.headers.get("authorization") ?? "";
  const actual = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  if (!timingSafeStringEqual(actual, expected)) {
    throw new ResetCreditError("API_UNAUTHORIZED", "Valid CRON_SECRET bearer token is required.", 401);
  }
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";

  return trimmed.length === 0 ? null : trimmed;
}
