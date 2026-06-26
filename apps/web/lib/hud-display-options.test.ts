import { describe, expect, it } from "vitest";
import { NOTIFICATION_WIDGET_KEYS } from "../components/NotificationSettingsModel";
import { buildHudCompactPreview, HUD_WIDGET_DISPLAY_EXAMPLES } from "./hud-display-options";

describe("HUD display options", () => {
  it("defines compact examples for every HUD widget", () => {
    expect(Object.keys(HUD_WIDGET_DISPLAY_EXAMPLES).sort()).toEqual([...NOTIFICATION_WIDGET_KEYS].sort());

    for (const widgetKey of NOTIFICATION_WIDGET_KEYS) {
      const option = HUD_WIDGET_DISPLAY_EXAMPLES[widgetKey];

      expect(option.shortLabel.trim().length).toBeGreaterThan(0);
      expect(option.example.trim().length).toBeGreaterThan(0);
    }
  });

  it("builds the compact clock-sized preview", () => {
    expect(buildHudCompactPreview([
      "codex_five_hour_percent",
      "codex_weekly_percent",
      "codex_reset_credit_count",
    ])).toBe("MS 5h 78% · W 69% · R2");
  });
});
