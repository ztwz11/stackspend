import { describe, expect, it, beforeEach } from "vitest";
import {
  clearLocalSecurityState,
  consumeOAuthTransaction,
  createLocalSession,
  createOAuthTransaction,
  localSessionCookie,
  requireLocalSession,
} from "./local-security";

beforeEach(() => {
  clearLocalSecurityState();
});

describe("local dashboard security helpers", () => {
  it("requires localhost, an opaque session cookie, and a CSRF header", () => {
    const session = createLocalSession(new Date("2026-06-08T00:00:00.000Z"));
    const request = new Request("http://127.0.0.1:3000/api/connections/openai/credentials", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
        cookie: localSessionCookie(session),
        "x-stackspend-csrf": session.csrfToken,
      },
    });

    expect(requireLocalSession(request, new Date("2026-06-08T00:01:00.000Z"))).toMatchObject({
      sessionId: session.sessionId,
    });
    expect(localSessionCookie(session)).not.toContain(session.csrfToken);
  });

  it("rejects non-local origins", () => {
    const session = createLocalSession();
    const request = new Request("http://127.0.0.1:3000/api/connections/openai/credentials", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
        origin: "https://example.com",
        cookie: localSessionCookie(session),
        "x-stackspend-csrf": session.csrfToken,
      },
    });

    expect(() => requireLocalSession(request)).toThrow("localhost");
  });

  it("owns OAuth state, nonce, and PKCE verifier server-side", () => {
    const session = createLocalSession();
    const request = new Request("http://127.0.0.1:3000/api/auth/start/supabase", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
      },
    });
    const transaction = createOAuthTransaction({
      provider: "supabase",
      request,
      session,
      now: new Date("2026-06-08T00:00:00.000Z"),
    });

    expect(transaction.redirectUri).toBe("http://127.0.0.1:3000/api/auth/callback/supabase");
    expect(transaction.codeChallenge).not.toBe(transaction.codeVerifier);
    expect(consumeOAuthTransaction("supabase", transaction.state)).toMatchObject({
      nonce: transaction.nonce,
      codeVerifier: transaction.codeVerifier,
    });
  });
});
