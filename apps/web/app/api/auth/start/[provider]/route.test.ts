import { beforeEach, describe, expect, it } from "vitest";
import { clearLocalSecurityState } from "../../../../../lib/local-security";
import { POST as createSession } from "../../session/route";
import { POST } from "./route";

beforeEach(() => {
  clearLocalSecurityState();
});

describe("POST /api/auth/start/[provider]", () => {
  it("creates server-held OAuth state, nonce, and PKCE without returning verifier material", async () => {
    const session = await createLocalSessionHeaders();
    const response = await POST(new Request("http://127.0.0.1:3000/api/auth/start/supabase", {
      method: "POST",
      headers: session,
    }), {
      params: Promise.resolve({
        provider: "supabase",
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      provider: "supabase",
      callbackUrl: "http://127.0.0.1:3000/api/auth/callback/supabase",
      pkce: "server_held",
      nonce: "server_held",
      oauthConfigured: false,
    });
    expect(payload.state).toEqual(expect.any(String));
    expect(JSON.stringify(payload)).not.toContain("codeVerifier");
  });
});

async function createLocalSessionHeaders(): Promise<Record<string, string>> {
  const response = await createSession(new Request("http://127.0.0.1:3000/api/auth/session", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
    },
  }));
  const payload = await response.json();

  return {
    host: "127.0.0.1:3000",
    origin: "http://127.0.0.1:3000",
    cookie: response.headers.get("set-cookie") ?? "",
    "x-stackspend-csrf": payload.csrfToken,
  };
}
