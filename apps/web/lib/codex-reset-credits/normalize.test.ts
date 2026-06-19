import { describe, expect, it } from "vitest";
import { normalizeResetCreditStatus } from "./normalize";

const NOW = new Date("2026-06-19T00:00:00.000Z");

describe("codex reset credit normalizer", () => {
  it("normalizes snake_case responses", () => {
    const status = normalizeResetCreditStatus({
      available_reset_credits: 2,
      total_earned_count: 3,
      reset_credits: [
        { expires_at: "2026-07-13T01:39:00.000Z", id: "secret-credit-id" },
      ],
      email: "user@example.com",
    }, NOW);

    expect(status.availableCount).toBe(2);
    expect(status.totalEarnedCount).toBe(3);
    expect(status.credits[0]?.expiresAtUtc).toBe("2026-07-13T01:39:00.000Z");
    expect(JSON.stringify(status)).not.toContain("secret-credit-id");
    expect(JSON.stringify(status)).not.toContain("user@example.com");
  });

  it("normalizes camelCase responses", () => {
    const status = normalizeResetCreditStatus({
      availableResetCredits: 1,
      totalEarnedCount: 1,
      resetCredits: [
        { expiresAt: "2026-06-20T00:00:00.000Z" },
      ],
    }, NOW);

    expect(status.availableCount).toBe(1);
    expect(status.totalEarnedCount).toBe(1);
    expect(status.credits[0]?.status).toBe("expiring-soon");
  });

  it("normalizes items arrays", () => {
    const status = normalizeResetCreditStatus({
      availableCount: 1,
      items: [
        { expirationTime: "2026-07-20T00:00:00.000Z" },
      ],
    }, NOW);

    expect(status.credits).toHaveLength(1);
    expect(status.credits[0]?.status).toBe("active");
  });

  it("supports ISO, Unix seconds, and Unix milliseconds", () => {
    const status = normalizeResetCreditStatus({
      credits: [
        { expiresAt: "2026-07-01T00:00:00.000Z" },
        { expiresAt: 1782864000 },
        { expiresAt: 1782950400000 },
      ],
    }, NOW);

    expect(status.credits.map((credit) => credit.expiresAtUtc)).toEqual([
      "2026-07-01T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z",
      "2026-07-02T00:00:00.000Z",
    ]);
  });

  it("marks invalid expiry values as unknown without failing the whole response", () => {
    const status = normalizeResetCreditStatus({
      credits: [
        { expiresAt: "not-a-date" },
      ],
    }, NOW);

    expect(status.credits[0]).toMatchObject({
      expiresAtUtc: null,
      remainingSeconds: null,
      status: "unknown",
    });
  });

  it("handles empty arrays and missing optional fields", () => {
    const status = normalizeResetCreditStatus({
      available: 0,
      credits: [],
    }, NOW);

    expect(status.availableCount).toBe(0);
    expect(status.totalEarnedCount).toBeNull();
    expect(status.credits).toEqual([]);
  });

  it("sorts credits by expiry and unknown values last", () => {
    const status = normalizeResetCreditStatus({
      credits: [
        { expiresAt: null },
        { expiresAt: "2026-08-01T00:00:00.000Z" },
        { expiresAt: "2026-06-20T00:00:00.000Z" },
      ],
    }, NOW);

    expect(status.credits.map((credit) => credit.expiresAtUtc)).toEqual([
      "2026-06-20T00:00:00.000Z",
      "2026-08-01T00:00:00.000Z",
      null,
    ]);
    expect(status.credits.map((credit) => credit.index)).toEqual([1, 2, 3]);
  });
});
