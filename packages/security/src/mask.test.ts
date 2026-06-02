import { describe, expect, it } from "vitest";
import { maskSecret } from "./mask.js";

describe("maskSecret", () => {
  it("returns an empty string for missing values", () => {
    expect(maskSecret(undefined)).toBe("");
    expect(maskSecret(null)).toBe("");
    expect(maskSecret("")).toBe("");
  });

  it("fully masks short values", () => {
    expect(maskSecret("short")).toBe("***");
  });

  it("keeps a small prefix and suffix for operator recognition", () => {
    expect(maskSecret("sk-test-fake-token-1234567890")).toBe("sk-t***7890");
  });
});
