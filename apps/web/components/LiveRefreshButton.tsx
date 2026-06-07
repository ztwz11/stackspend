"use client";

import { useTransition } from "react";

export function LiveRefreshButton({ label }: { label: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      aria-busy={isPending}
      className="ghost-button"
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
