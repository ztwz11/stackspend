"use client";

import { AlertTriangle } from "lucide-react";
import type { ResetCreditApiFailure } from "../../lib/codex-reset-credits/types";

const TEXT = {
  title: "\uc870\ud68c \uc2e4\ud328",
  loginHint: "\ud130\ubbf8\ub110\uc5d0\uc11c codex login\uc744 \uc2e4\ud589\ud55c \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud558\uc138\uc694.",
  localOnlyHint: "\u0056\u0065\u0072\u0063\u0065\u006c \uac19\uc740 \uc6d0\uaca9 \uc11c\ubc84\uc5d0 auth.json\uc744 \uc5c5\ub85c\ub4dc\ud558\uc9c0 \ub9d0\uace0, Codex\uac00 \ub85c\uadf8\uc778\ub41c \uac19\uc740 PC\uc5d0\uc11c \uc2e4\ud589\ud558\uc138\uc694.",
};

export function ResetCreditError({ error }: { error: ResetCreditApiFailure["error"] }) {
  return (
    <section className="panel reset-credit-error" role="alert">
      <div className="reset-credit-error-title">
        <AlertTriangle aria-hidden="true" size={18} />
        <h2>{TEXT.title}</h2>
      </div>
      <p>{error.message}</p>
      <code>{error.code}</code>
      {error.code === "UPSTREAM_UNAUTHORIZED" ? (
        <p>{TEXT.loginHint}</p>
      ) : null}
      {error.code === "LOCAL_CODEX_AUTH_UNAVAILABLE" ? (
        <p>{TEXT.localOnlyHint}</p>
      ) : null}
    </section>
  );
}
