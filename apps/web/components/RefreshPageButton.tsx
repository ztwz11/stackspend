"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const MIN_REFRESH_VISIBLE_MS = 450;

export function RefreshPageButton({ label }: { label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingVisible, setLoadingVisible] = useState(false);
  const [progress, setProgress] = useState(8);
  const loadingStartedAtRef = useRef(0);
  const loadingActive = isPending || loadingVisible;

  useEffect(() => {
    if (!loadingActive) {
      setProgress(8);
      return;
    }

    setProgress(18);
    const interval = setInterval(() => {
      setProgress((current) => Math.min(current + Math.max(1, (92 - current) * 0.14), 92));
    }, 260);

    return () => clearInterval(interval);
  }, [loadingActive]);

  useEffect(() => {
    if (!loadingVisible || isPending) {
      return;
    }

    const elapsedMs = Date.now() - loadingStartedAtRef.current;
    const timeout = window.setTimeout(() => {
      setLoadingVisible(false);
    }, Math.max(0, MIN_REFRESH_VISIBLE_MS - elapsedMs));

    return () => window.clearTimeout(timeout);
  }, [isPending, loadingVisible]);

  return (
    <>
      <button
        aria-busy={loadingActive}
        className="ghost-button header-control"
        disabled={loadingActive}
        onClick={() => {
          if (loadingActive) {
            return;
          }

          loadingStartedAtRef.current = Date.now();
          setLoadingVisible(true);
          startTransition(() => {
            router.refresh();
          });
        }}
        title={label}
        type="button"
      >
        <RefreshCw aria-hidden="true" size={14} />
        <span>{label}</span>
      </button>
      {loadingActive ? (
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
