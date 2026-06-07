import { afterEach, describe, expect, it } from "vitest";
import { clearLiveTodayCache } from "../../../lib/live-today";
import { GET } from "./route";

const originalCredentialBackend = process.env.STACKSPEND_CREDENTIAL_BACKEND;
const originalOpenAiAdminKey = process.env.OPENAI_ADMIN_KEY;

afterEach(() => {
  if (originalCredentialBackend === undefined) {
    delete process.env.STACKSPEND_CREDENTIAL_BACKEND;
  } else {
    process.env.STACKSPEND_CREDENTIAL_BACKEND = originalCredentialBackend;
  }

  if (originalOpenAiAdminKey === undefined) {
    delete process.env.OPENAI_ADMIN_KEY;
  } else {
    process.env.OPENAI_ADMIN_KEY = originalOpenAiAdminKey;
  }
});

describe("GET /api/live-today", () => {
  it("returns an empty provisional cache without provider secrets", async () => {
    clearLiveTodayCache();
    process.env.STACKSPEND_CREDENTIAL_BACKEND = "vault";
    process.env.OPENAI_ADMIN_KEY = "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS";

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toMatchObject({
      ttlSeconds: 60,
      cacheState: "empty",
    });
    expect(JSON.stringify(payload)).not.toContain("FAKE_OPENAI_ADMIN_KEY_FOR_TESTS");
  });
});
