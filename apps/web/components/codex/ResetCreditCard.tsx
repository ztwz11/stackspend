"use client";

import { AlertTriangle, CheckCircle2, Clock3, HelpCircle } from "lucide-react";
import type { ResetCredit } from "../../lib/codex-reset-credits/types";

const TEXT = {
  credit: "\ucd08\uae30\ud654\uad8c",
  unknownExpiry: "\ub9cc\ub8cc \uc2dc\uac01 \uc54c \uc218 \uc5c6\uc74c",
  active: "\ud65c\uc131",
  expiringSoon: "\ub9cc\ub8cc \uc784\ubc15",
  expired: "\ub9cc\ub8cc\ub428",
  unknown: "\uc54c \uc218 \uc5c6\uc74c",
  remaining: "\ub0a8\uc740 \uae30\uac04",
  utcExpiry: "\u0055\u0054\u0043 \ub9cc\ub8cc \uc2dc\uac01",
  daysLeft: "\uc77c \ub0a8\uc74c",
  day: "\uc77c",
  hour: "\uc2dc\uac04",
  minute: "\ubd84",
  left: "\ub0a8\uc74c",
};

export function ResetCreditCard({ credit }: { credit: ResetCredit }) {
  return (
    <article className="reset-credit-card">
      <div className="reset-credit-card-header">
        <div>
          <span className="metric-label">{TEXT.credit} #{credit.index}</span>
          <h2>{credit.expiresAtUtc === null ? TEXT.unknownExpiry : formatDateTime(credit.expiresAtUtc)}</h2>
        </div>
        <span className={`reset-credit-badge reset-credit-badge-${credit.status}`}>
          <StatusIcon status={credit.status} />
          {statusLabel(credit.status)}
        </span>
      </div>
      <dl className="reset-credit-details">
        <div>
          <dt>{TEXT.remaining}</dt>
          <dd>{formatRemaining(credit.remainingSeconds, credit.status)}</dd>
        </div>
        <div>
          <dt>{TEXT.utcExpiry}</dt>
          <dd>{credit.expiresAtUtc ?? "-"}</dd>
        </div>
      </dl>
    </article>
  );
}

function StatusIcon({ status }: { status: ResetCredit["status"] }) {
  if (status === "active") {
    return <CheckCircle2 aria-hidden="true" size={14} />;
  }

  if (status === "expiring-soon") {
    return <Clock3 aria-hidden="true" size={14} />;
  }

  if (status === "expired") {
    return <AlertTriangle aria-hidden="true" size={14} />;
  }

  return <HelpCircle aria-hidden="true" size={14} />;
}

function statusLabel(status: ResetCredit["status"]): string {
  switch (status) {
    case "active":
      return TEXT.active;
    case "expiring-soon":
      return TEXT.expiringSoon;
    case "expired":
      return TEXT.expired;
    case "unknown":
      return TEXT.unknown;
  }
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatRemaining(seconds: number | null, status: ResetCredit["status"]): string {
  if (status === "expired") {
    return TEXT.expired;
  }

  if (seconds === null) {
    return "-";
  }

  const minutes = Math.max(1, Math.floor(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 7) {
    return `${days}${TEXT.daysLeft}`;
  }

  if (days >= 1) {
    return `${days}${TEXT.day} ${hours % 24}${TEXT.hour} ${TEXT.left}`;
  }

  if (hours >= 1) {
    return `${hours}${TEXT.hour} ${minutes % 60}${TEXT.minute} ${TEXT.left}`;
  }

  return `${minutes}${TEXT.minute} ${TEXT.left}`;
}
