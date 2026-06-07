import { afterEach, describe, expect, it, vi } from "vitest";
import { validateReadOnlyCredential } from "./credential-validation";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("credential validation", () => {
  it("validates OpenAI credentials through read-only Usage/Costs requests", async () => {
    const requests: string[] = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      requests.push(String(input));
      return Response.json({
        data: [],
      });
    }) as typeof fetch;

    await expect(validateReadOnlyCredential("openai", {
      secret: "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
    }, new Date("2026-06-08T00:00:00.000Z"))).resolves.toEqual({
      validatedAt: "2026-06-08T00:00:00.000Z",
    });
    expect(requests.some((request) => request.includes("/v1/organization/usage/completions"))).toBe(true);
    expect(requests.some((request) => request.includes("/v1/organization/costs"))).toBe(true);
  });

  it("requires Cloudflare account ids for read-only validation", async () => {
    await expect(validateReadOnlyCredential("cloudflare", {
      secret: "FAKE_CLOUDFLARE_TOKEN_FOR_TESTS",
    })).rejects.toThrow("account IDs");
  });
});
