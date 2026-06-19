import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCodexAuthJsonText, readCodexAuth } from "./auth";
import { ResetCreditError } from "./errors";

describe("codex auth parser", () => {
  it.each([
    [{ tokens: { access_token: "token-a" }, account: { id: "account-a" } }, "token-a"],
    [{ tokens: { accessToken: "token-b" }, account: { id: "account-b" } }, "token-b"],
    [{ access_token: "token-c", account: { id: "account-c" } }, "token-c"],
    [{ accessToken: "token-d", account: { id: "account-d" } }, "token-d"],
  ])("reads access token aliases", (payload, expectedToken) => {
    expect(parseCodexAuthJsonText(JSON.stringify(payload)).accessToken).toBe(expectedToken);
  });

  it.each([
    [{ tokens: { access_token: "token" }, account: { id: "account-a" } }, "account-a"],
    [{ tokens: { access_token: "token", account_id: "account-b" } }, "account-b"],
    [{ tokens: { access_token: "token", accountId: "account-c" } }, "account-c"],
    [{ access_token: "token", account_id: "account-d" }, "account-d"],
    [{ access_token: "token", accountId: "account-e" }, "account-e"],
    [{ access_token: "token", profile: { account_id: "account-f" } }, "account-f"],
    [{ access_token: "token", profile: { accountId: "account-g" } }, "account-g"],
  ])("reads account id aliases", (payload, expectedAccountId) => {
    expect(parseCodexAuthJsonText(JSON.stringify(payload)).accountId).toBe(expectedAccountId);
  });

  it("rejects missing access tokens", () => {
    expect(() => parseCodexAuthJsonText(JSON.stringify({ account: { id: "account" } })))
      .toThrow("access token");
  });

  it("rejects missing account id", () => {
    expect(() => parseCodexAuthJsonText(JSON.stringify({ accessToken: "token" })))
      .toThrow("account ID");
  });

  it("rejects invalid JSON", () => {
    expect(() => parseCodexAuthJsonText("{"))
      .toThrow("JSON");
  });

  it("reports missing auth file without leaking the path", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "moneysiren-codex-auth-")), "missing-auth.json");

    await expect(readCodexAuth({ env: { CODEX_AUTH_FILE: path } })).rejects.toMatchObject({
      code: "AUTH_FILE_NOT_FOUND",
    });

    await readCodexAuth({ env: { CODEX_AUTH_FILE: path } }).catch((caught) => {
      expect(caught).toBeInstanceOf(ResetCreditError);
      expect(String(caught)).not.toContain(path);
    });
  });

  it("reads a configured auth file on every request", async () => {
    const dir = await mkdtemp(join(tmpdir(), "moneysiren-codex-auth-"));
    const path = join(dir, "auth.json");
    await writeFile(path, JSON.stringify({ accessToken: "token-1", accountId: "account-1" }), "utf8");
    await expect(readCodexAuth({ env: { CODEX_AUTH_FILE: path } })).resolves.toMatchObject({
      accessToken: "token-1",
      accountId: "account-1",
    });

    await writeFile(path, JSON.stringify({ accessToken: "token-2", accountId: "account-2" }), "utf8");
    await expect(readCodexAuth({ env: { CODEX_AUTH_FILE: path } })).resolves.toMatchObject({
      accessToken: "token-2",
      accountId: "account-2",
    });
  });
});
