import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEncryptedVaultCredentialStore, createMemoryCredentialStore } from "../../../packages/credentials/src/index";
import { readConnectionsStatus, summarizeConnectionState } from "./connection-status";

describe("connection status", () => {
  it("summarizes env and credential-store status without returning secret values", async () => {
    const store = createMemoryCredentialStore({
      now: () => new Date("2026-06-08T00:00:00.000Z"),
    });
    await store.setCredential("openai", "read-only", {
      secret: "FAKE_OPENAI_ADMIN_KEY_FOR_TESTS",
      authMethod: "api_key",
    });

    const payload = await readConnectionsStatus({
      env: {
        AWS_PROFILE: "fake-profile",
      },
      credentialStore: store,
      now: () => new Date("2026-06-08T00:00:00.000Z"),
    });

    expect(payload).toMatchObject({
      localOnly: true,
      secretsReturned: false,
      providerWriteActionsEnabled: false,
    });
    expect(payload.providers.find((provider) => provider.providerKey === "aws")).toMatchObject({
      connectionState: "env_configured",
      credentialSource: "env",
      readOnlyTestState: "read_only_ready",
    });
    expect(payload.providers.find((provider) => provider.providerKey === "openai")).toMatchObject({
      connectionState: "credential_store_configured",
      credentialSource: "credential_store",
      readOnlyTestState: "read_only_ready",
    });
    expect(JSON.stringify(payload)).not.toContain("FAKE_OPENAI_ADMIN_KEY_FOR_TESTS");
    expect(JSON.stringify(payload)).not.toContain("fake-profile");
  });

  it("reports a locked vault without exposing credential material", async () => {
    const dir = await mkdtemp(join(tmpdir(), "stackspend-web-connections-"));
    const vaultPath = join(dir, "locked-vault.json");
    const unlocked = createEncryptedVaultCredentialStore({
      passphrase: "fake passphrase",
      vaultPath,
      now: () => new Date("2026-06-08T00:00:00.000Z"),
    });
    await unlocked.setCredential("supabase", "read-only", {
      secret: "FAKE_SUPABASE_PAT_FOR_TESTS",
      authMethod: "pat",
    });
    const locked = createEncryptedVaultCredentialStore({
      vaultPath,
      now: () => new Date("2026-06-08T00:00:00.000Z"),
    });

    const payload = await readConnectionsStatus({
      credentialStore: locked,
      now: () => new Date("2026-06-08T00:00:00.000Z"),
    });

    expect(payload.providers.find((provider) => provider.providerKey === "supabase")).toMatchObject({
      connectionState: "locked",
      credentialSource: "locked",
      credentialStore: {
        storeState: "locked",
      },
    });
    expect(JSON.stringify(payload)).not.toContain("FAKE_SUPABASE_PAT_FOR_TESTS");
  });

  it("keeps connection precedence explicit", () => {
    expect(summarizeConnectionState(true, {
      provider: "openai",
      scope: "read-only",
      backend: "memory",
      storeState: "ready",
      state: "credential_store_configured",
    })).toBe("env_configured");
  });
});
