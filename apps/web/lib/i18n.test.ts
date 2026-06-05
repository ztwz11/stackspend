import { describe, expect, it } from "vitest";
import {
  LOCALES,
  detectLocale,
  getMessages,
  replaceLocale,
  type Locale,
} from "./i18n";

describe("web i18n", () => {
  it("detects supported locales from Accept-Language", () => {
    expect(detectLocale("ko-KR,ko;q=0.9,en;q=0.8")).toBe("ko");
    expect(detectLocale("ja-JP,ja;q=0.9,en;q=0.8")).toBe("ja");
    expect(detectLocale("fr-FR,fr;q=0.9")).toBe("en");
    expect(detectLocale(null)).toBe("en");
  });

  it("keeps message keys aligned across locales", () => {
    const reference = flattenKeys(getMessages("en"));

    for (const locale of LOCALES) {
      expect(flattenKeys(getMessages(locale))).toEqual(reference);
    }
  });

  it("replaces an existing locale path segment", () => {
    expect(replaceLocale("/ko/dashboard/overview", "ja")).toBe("/ja/dashboard/overview");
    expect(replaceLocale("/dashboard/overview", "ko")).toBe("/ko/dashboard/overview");
  });
});

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }

  return Object.entries(value)
    .flatMap(([key, nested]) => flattenKeys(nested, prefix.length === 0 ? key : `${prefix}.${key}`))
    .sort();
}
