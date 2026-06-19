"use client";

import { useTransition } from "react";

export function LiveRefreshButton({ className = "ghost-button", label }: { className?: string; label: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      aria-busy={isPending}
      className={className}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const response = await fetch("/api/live-today", {
            method: "POST",
          });

          if (!response.ok) {
            return;
          }

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
