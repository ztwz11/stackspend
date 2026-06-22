"use client";

import { useEffect, useState } from "react";
import { refreshLocalLive } from "../lib/local-client";

const MIN_REFRESH_VISIBLE_MS = 450;

export function LiveRefreshButton({ className = "ghost-button", label }: { className?: string; label: string }) {
  const [isPending, setIsPending] = useState(false);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    if (!isPending) {
      setProgress(8);
      return;
    }

    setProgress(18);
    const interval = setInterval(() => {
      setProgress((current) => Math.min(current + Math.max(1, (92 - current) * 0.14), 92));
    }, 260);

    return () => clearInterval(interval);
  }, [isPending]);

  return (
    <>
      <button
        aria-busy={isPending}
        className={className}
        disabled={isPending}
        onClick={async () => {
          if (isPending) {
            return;
          }

          const startedAt = Date.now();
          let shouldReload = false;
          setIsPending(true);

          try {
            await refreshLocalLive("all");
            const remainingMs = MIN_REFRESH_VISIBLE_MS - (Date.now() - startedAt);

            if (remainingMs > 0) {
              await new Promise((resolve) => setTimeout(resolve, remainingMs));
            }

            shouldReload = true;
          } finally {
            if (shouldReload) {
              window.location.reload();
              window.setTimeout(() => setIsPending(false), 5_000);
            } else {
              setIsPending(false);
            }
          }
        }}
        title={label}
        type="button"
      >
        {label}
      </button>
      {isPending ? (
        <div className="app-loading-overlay" aria-live="polite" aria-busy="true" role="status">
          <div className="app-loading-card">
            <div className="app-loading-label">{label}</div>
            <div className="app-loading-track" aria-hidden="true">
              <span className="app-loading-bar" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
