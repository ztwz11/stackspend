"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const APP_LOADING_EVENT = "moneysiren:app-loading";
const MIN_MANUAL_VISIBLE_MS = 450;
const NAVIGATION_TIMEOUT_MS = 12_000;
const MANUAL_TIMEOUT_MS = 30_000;

type AppLoadingReason = "navigation" | "manual";

interface AppLoadingEventDetail {
  id: number;
  label?: string;
  reason: AppLoadingReason;
  type: "start" | "finish";
}

interface AppLoadingEntry {
  label: string;
  reason: AppLoadingReason;
}

let nextLoadingId = 1;

export function beginAppLoading(label = "Loading", reason: AppLoadingReason = "manual"): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const id = nextLoadingId;
  nextLoadingId += 1;
  window.dispatchEvent(new CustomEvent<AppLoadingEventDetail>(APP_LOADING_EVENT, {
    detail: {
      id,
      label,
      reason,
      type: "start",
    },
  }));

  let finished = false;

  return () => {
    if (finished) {
      return;
    }

    finished = true;
    window.dispatchEvent(new CustomEvent<AppLoadingEventDetail>(APP_LOADING_EVENT, {
      detail: {
        id,
        reason,
        type: "finish",
      },
    }));
  };
}

export async function withAppLoading<T>(label: string, action: () => Promise<T>): Promise<T> {
  const finish = beginAppLoading(label, "manual");
  const startedAt = Date.now();

  try {
    return await action();
  } finally {
    const remainingMs = MIN_MANUAL_VISIBLE_MS - (Date.now() - startedAt);

    if (remainingMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingMs));
    }

    finish();
  }
}

export function AppLoadingOverlay({
  navigationLabel,
  savingLabel,
}: {
  navigationLabel: string;
  savingLabel: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState<Map<number, AppLoadingEntry>>(() => new Map());
  const [progress, setProgress] = useState(8);
  const navigationFinishRef = useRef<(() => void) | null>(null);
  const timeoutRefs = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const visible = entries.size > 0;
  const entryValues = [...entries.values()];
  const activeEntry = entryValues[entryValues.length - 1];
  const activeLabel = activeEntry?.label ?? savingLabel;

  useEffect(() => {
    const handleLoadingEvent = (event: Event) => {
      const detail = (event as CustomEvent<AppLoadingEventDetail>).detail;

      if (detail?.type === "start") {
        setEntries((current) => {
          const next = new Map(current);
          next.set(detail.id, {
            label: detail.label ?? (detail.reason === "navigation" ? navigationLabel : savingLabel),
            reason: detail.reason,
          });
          return next;
        });

        const timeout = setTimeout(() => {
          window.dispatchEvent(new CustomEvent<AppLoadingEventDetail>(APP_LOADING_EVENT, {
            detail: {
              id: detail.id,
              reason: detail.reason,
              type: "finish",
            },
          }));
        }, detail.reason === "navigation" ? NAVIGATION_TIMEOUT_MS : MANUAL_TIMEOUT_MS);

        timeoutRefs.current.set(detail.id, timeout);
        return;
      }

      if (detail?.type === "finish") {
        const timeout = timeoutRefs.current.get(detail.id);

        if (timeout !== undefined) {
          clearTimeout(timeout);
          timeoutRefs.current.delete(detail.id);
        }

        setEntries((current) => {
          if (!current.has(detail.id)) {
            return current;
          }

          const next = new Map(current);
          next.delete(detail.id);
          return next;
        });
      }
    };

    window.addEventListener(APP_LOADING_EVENT, handleLoadingEvent);

    return () => {
      window.removeEventListener(APP_LOADING_EVENT, handleLoadingEvent);
      for (const timeout of timeoutRefs.current.values()) {
        clearTimeout(timeout);
      }
      timeoutRefs.current.clear();
    };
  }, [navigationLabel, savingLabel]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);

      if (destination.origin !== current.origin) {
        return;
      }

      if (destination.pathname === current.pathname && destination.search === current.search) {
        return;
      }

      navigationFinishRef.current?.();
      navigationFinishRef.current = beginAppLoading(navigationLabel, "navigation");
    };

    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [navigationLabel]);

  useEffect(() => {
    navigationFinishRef.current?.();
    navigationFinishRef.current = null;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!visible) {
      setProgress(8);
      return;
    }

    setProgress(18);
    const interval = setInterval(() => {
      setProgress((current) => Math.min(current + Math.max(1, (92 - current) * 0.14), 92));
    }, 260);

    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <div className="app-loading-overlay" aria-live="polite" aria-busy="true" role="status">
      <div className="app-loading-card">
        <div className="app-loading-label">{activeLabel}</div>
        <div className="app-loading-track" aria-hidden="true">
          <span className="app-loading-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
