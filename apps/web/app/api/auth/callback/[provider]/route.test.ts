import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLocalSecurityState,
  createLocalSession,
  createOAuthTransaction,
} from "../../../../../lib/local-security";
import { GET } from "./route";

beforeEach(() => {
  clearLocalSecurityState();
});

describe("GET /api/auth/callback/[provider]", () => {
  it("accepts only a matching localhost OAuth transaction", async () => {
    const session = createLocalSession();
    const transaction = createOAuthTransaction({
      provider: "supabase",
      session,
      request: new Request("http://127.0.0.1:3000/api/auth/start/supabase", {
        method: "POST",
        headers: {
          host: "127.0.0.1:3000",
        },
      }),
    });
    const response = await GET(new Request(
      `http://127.0.0.1:3000/api/auth/callback/supabase?state=${transaction.state}&code=FAKE_CODE`,
      {
        headers: {
          host: "127.0.0.1:3000",
        },
      },
    ), {
      params: Promise.resolve({
        provider: "supabase",
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      provider: "supabase",
      status: "oauth_callback_received",
      credentialStored: false,
      secretsReturned: false,
    });
  });
});
