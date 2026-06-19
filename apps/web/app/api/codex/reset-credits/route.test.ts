import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.CODEX_AUTH_FILE;
  delete process.env.CODEX_HOME;
  delete process.env.CODEX_RESET_CREDIT_ENDPOINT;
  delete process.env.CODEX_API_TIMEOUT_MS;
  delete process.env.RESET_CREDIT_API_KEY;
  delete process.env.VERCEL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
});

describe("Codex reset credit API route", () => {
  it("returns normalized success responses without auth secrets", async () => {
    await configureAuthFile();
    stubFetchJson(200, {
      available_reset_credits: 1,
      total_earned_count: 1,
      reset_credits: [
        { expires_at: "2026-07-13T01:39:00.000Z", id: "credit-secret-id", email: "user@example.com" },
      ],
    });

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      data: {
        availableCount: 1,
      },
      meta: {
        timeZone: "Asia/Seoul",
        source: "chatgpt-internal-api",
        unofficial: true,
      },
    });
    expect(JSON.stringify(payload)).not.toContain("access-token");
    expect(JSON.stringify(payload)).not.toContain("account-id");
    expect(JSON.stringify(payload)).not.toContain("credit-secret-id");
    expect(JSON.stringify(payload)).not.toContain("user@example.com");
  });

  it("reports missing auth files safely", async () => {
    process.env.CODEX_AUTH_FILE = join(await mkdtemp(join(tmpdir(), "moneysiren-route-auth-")), "missing.json");
    stubFetchJson(200, { available: 0 });

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      ok: false,
      error: {
        code: "AUTH_FILE_NOT_FOUND",
      },
    });
    expect(JSON.stringify(payload)).not.toContain(process.env.CODEX_AUTH_FILE);
  });

  it.each([
    [401, "UPSTREAM_UNAUTHORIZED"],
    [403, "UPSTREAM_FORBIDDEN"],
    [429, "UPSTREAM_RATE_LIMITED"],
    [500, "UPSTREAM_UNAVAILABLE"],
  ] as const)("maps upstream HTTP %s", async (status, code) => {
    await configureAuthFile();
    stubFetchJson(status, {});

    const response = await GET(request());
    const payload = await response.json();

    expect(payload).toMatchObject({
      ok: false,
      error: { code },
    });
  });

  it("maps upstream timeout", async () => {
    await configureAuthFile();
    process.env.CODEX_API_TIMEOUT_MS = "1000";
    vi.stubGlobal("fetch", vi.fn((_url: string | URL | Request, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      })
    ));

    const response = await GET(request());
    const payload = await response.json();

    expect(payload).toMatchObject({
      ok: false,
      error: { code: "UPSTREAM_TIMEOUT" },
    });
  });

  it("maps invalid upstream JSON", async () => {
    await configureAuthFile();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not-json", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));

    const response = await GET(request());
    const payload = await response.json();

    expect(payload).toMatchObject({
      ok: false,
      error: { code: "UPSTREAM_INVALID_JSON" },
    });
  });

  it("requires RESET_CREDIT_API_KEY when configured", async () => {
    await configureAuthFile();
    process.env.RESET_CREDIT_API_KEY = "local-api-key";
    stubFetchJson(200, { available: 0 });

    const rejected = await GET(request());
    const accepted = await GET(request({
      authorization: "Bearer local-api-key",
    }));

    await expect(rejected.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "API_UNAUTHORIZED" },
    });
    expect(accepted.status).toBe(200);
  });
});

async function configureAuthFile(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "moneysiren-route-auth-"));
  const path = join(dir, "auth.json");
  await writeFile(path, JSON.stringify({
    accessToken: "access-token",
    accountId: "account-id",
  }), "utf8");
  process.env.CODEX_AUTH_FILE = path;
}

function request(headers: Record<string, string> = {}): Request {
  return new Request("http://127.0.0.1:3000/api/codex/reset-credits", {
    headers,
    method: "GET",
  });
}

function stubFetchJson(status: number, payload: unknown): void {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(payload, { status })));
}
