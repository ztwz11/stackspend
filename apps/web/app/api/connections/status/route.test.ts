import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const originalOpenAiAdminKey = process.env.OPENAI_ADMIN_KEY;
const originalCredentialBackend = process.env.STACKSPEND_CREDENTIAL_BACKEND;

afterEach(() => {
  if (originalOpenAiAdminKey === undefined) {
    delete process.env.OPENAI_ADMIN_KEY;
  } else {
    process.env.OPENAI_ADMIN_KEY = originalOpenAiAdminKey;
  }

  if (originalCredentialBackend === undefined) {
    delete process.env.STACKSPEND_CREDENTIAL_BACKEND;
  } else {
    process.env.STACKSPEND_CREDENTIAL_BACKEND = originalCredentialBackend;
  }
});

describe("GET /api/connections/status", () => {
  it("returns connection states without secret values", async () => {
    process.env.OPENAI_ADMIN_KEY = "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS";
    process.env.STACKSPEND_CREDENTIAL_BACKEND = "vault";

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.providers.find((provider: { providerKey: string }) => provider.providerKey === "openai"))
      .toMatchObject({
        connectionState: "env_configured",
        readOnlyTestState: "env_configured",
      });
    expect(JSON.stringify(payload)).not.toContain("FAKE_OPENAI_ADMIN_KEY_FOR_TESTS");
    expect(payload).toMatchObject({
      localOnly: true,
      secretsReturned: false,
      providerWriteActionsEnabled: false,
    });
  });
});
