"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ResetCreditApiFailure, ResetCreditApiResponse, ResetCreditStatus } from "../../lib/codex-reset-credits/types";
import { ResetCreditCard } from "./ResetCreditCard";
import { ResetCreditError } from "./ResetCreditError";

const AUTO_REFRESH_MS = 30 * 60 * 1000;
const TEXT = {
  eyebrow: "\u004d\u006f\u006e\u0065\u0079\u0053\u0069\u0072\u0065\u006e local Codex monitor",
  title: "\u0043\u006f\u0064\u0065\u0078 \ucd08\uae30\ud654\uad8c \ub9cc\ub8cc\uc77c",
  subtitle: "\ub85c\uceec Codex \ub85c\uadf8\uc778 \uc815\ubcf4\ub97c \uc11c\ubc84\uc5d0\uc11c\ub9cc \uc77d\uc5b4 \ucd08\uae30\ud654\uad8c \ub9cc\ub8cc \uc608\uc815 \uc2dc\uac04\uc744 \ud655\uc778\ud569\ub2c8\ub2e4.",
  loading: "\uc870\ud68c \uc911",
  refresh: "\uc0c8\ub85c\uace0\uce68",
  available: "\ud604\uc7ac \ubcf4\uc720 \ucd08\uae30\ud654\uad8c",
  total: "\ucd1d \uc9c0\uae09 \uac1c\uc218",
  fetchedAt: "\ub9c8\uc9c0\ub9c9 \uc870\ud68c \uc2dc\uac01",
  status: "\uc0c1\ud0dc",
  unofficial: "\ube44\uacf5\uc2dd \ub0b4\ubd80 API",
  loadingTitle: "\uc870\ud68c \uc911",
  loadingBody: "\u0043\u006f\u0064\u0065\u0078 \ucd08\uae30\ud654\uad8c \uc815\ubcf4\ub97c \ubd88\ub7ec\uc624\uace0 \uc788\uc2b5\ub2c8\ub2e4.",
  emptyTitle: "\ucd08\uae30\ud654\uad8c \uc815\ubcf4 \uc5c6\uc74c",
  emptyBody: "\ud604\uc7ac API \uc751\ub2f5\uc5d0\uc11c \uac1c\ubcc4 \ucd08\uae30\ud654\uad8c \ub9cc\ub8cc \uc815\ubcf4\ub97c \ucc3e\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.",
  footer: "\uc774 \uae30\ub2a5\uc740 \ubb38\uc11c\ud654\ub418\uc9c0 \uc54a\uc740 ChatGPT \ub0b4\ubd80 API\ub97c \uc0ac\uc6a9\ud558\ubbc0\ub85c \uc608\uace0 \uc5c6\uc774 \ub3d9\uc791\uc774 \ubcc0\uacbd\ub420 \uc218 \uc788\uc2b5\ub2c8\ub2e4.",
  fallbackError: "\u0043\u006f\u0064\u0065\u0078 \ucd08\uae30\ud654\uad8c \uc815\ubcf4\ub97c \uc870\ud68c\ud558\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.",
  countSuffix: "\uac1c",
};

type LoadState = "idle" | "loading" | "error";

export function ResetCreditDashboard() {
  const [data, setData] = useState<ResetCreditStatus | null>(null);
  const [error, setError] = useState<ResetCreditApiFailure["error"] | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const sortedCredits = useMemo(() => data?.credits ?? [], [data?.credits]);

  useEffect(() => {
    let mounted = true;

    void load().then((result) => {
      if (mounted) {
        applyResult(result);
      }
    });

    const interval = window.setInterval(() => {
      void refresh();
    }, AUTO_REFRESH_MS);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <main className="reset-credit-page">
      <header className="reset-credit-hero">
        <div>
          <p className="metric-label">{TEXT.eyebrow}</p>
          <h1>{TEXT.title}</h1>
          <p>{TEXT.subtitle}</p>
        </div>
        <button
          className="primary-button"
          disabled={loadState === "loading"}
          onClick={() => {
            void refresh();
          }}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={14} />
          <span>{loadState === "loading" ? TEXT.loading : TEXT.refresh}</span>
        </button>
      </header>

      <section className="reset-credit-summary" aria-label="Codex reset credit summary">
        <SummaryTile label={TEXT.available} value={formatCount(data?.availableCount)} />
        <SummaryTile label={TEXT.total} value={formatCount(data?.totalEarnedCount)} />
        <SummaryTile label={TEXT.fetchedAt} value={data === null ? "-" : formatDateTime(data.fetchedAtUtc)} />
        <SummaryTile label={TEXT.status} value={TEXT.unofficial} emphasis />
      </section>

      {loadState === "error" && error !== null ? (
        <ResetCreditError error={error} />
      ) : null}

      {loadState === "loading" && data === null ? (
        <section className="panel reset-credit-empty">
          <h2>{TEXT.loadingTitle}</h2>
          <p>{TEXT.loadingBody}</p>
        </section>
      ) : null}

      {loadState !== "loading" && data !== null && sortedCredits.length === 0 ? (
        <section className="panel reset-credit-empty">
          <h2>{TEXT.emptyTitle}</h2>
          <p>{TEXT.emptyBody}</p>
        </section>
      ) : null}

      {sortedCredits.length > 0 ? (
        <section className="reset-credit-list" aria-label="Codex reset credit expiry list">
          {sortedCredits.map((credit) => (
            <ResetCreditCard credit={credit} key={`${credit.index}-${credit.expiresAtUtc ?? "unknown"}`} />
          ))}
        </section>
      ) : null}

      <footer className="reset-credit-footer">
        {TEXT.footer}
      </footer>
    </main>
  );

  async function refresh(): Promise<void> {
    setLoadState("loading");
    const result = await load();
    applyResult(result);
  }

  function applyResult(result: ResetCreditApiResponse): void {
    if (result.ok) {
      setData(result.data);
      setError(null);
      setLoadState("idle");
      return;
    }

    setError(result.error);
    setLoadState("error");
  }
}

async function load(): Promise<ResetCreditApiResponse> {
  try {
    const response = await fetch("/api/codex/reset-credits", {
      cache: "no-store",
      credentials: "same-origin",
    });
    const payload = await response.json() as ResetCreditApiResponse;

    return payload;
  } catch {
    return {
      ok: false,
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: TEXT.fallbackError,
      },
    };
  }
}

function SummaryTile({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={emphasis ? "reset-credit-summary-tile reset-credit-summary-tile-warning" : "reset-credit-summary-tile"}>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : `${value}${TEXT.countSuffix}`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
