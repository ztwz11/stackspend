"use client";

import { useTransition } from "react";
import { refreshLocalLive } from "../lib/local-client";

export function LiveRefreshButton({ className = "ghost-button", label }: { className?: string; label: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      aria-busy={isPending}
      className={className}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await refreshLocalLive("all");
          window.location.reload();
        });
      }}
      title={label}
      type="button"
    >
      {label}
    </button>
  );
}
