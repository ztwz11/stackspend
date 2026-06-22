"use client";

import { useEffect } from "react";
import { refreshLocalLive } from "../lib/local-client";

const TRAY_ACTION_EVENT = "moneysiren://tray-action";

export function TrayActionBridge() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    void import("@tauri-apps/api/event")
      .then(({ listen }) => listen<string>(TRAY_ACTION_EVENT, async (event) => {
        if (event.payload !== "refresh-now") {
          return;
        }

        try {
          await refreshLocalLive("all");
          window.dispatchEvent(new CustomEvent("moneysiren:live-refresh"));
        } catch (error) {
          console.warn("MoneySiren tray refresh failed.", error);
        }
      }))
      .then((nextUnlisten) => {
        if (disposed) {
          nextUnlisten();
          return;
        }

        unlisten = nextUnlisten;
      })
      .catch(() => {
        // The browser-only web app does not expose Tauri events.
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return null;
}
