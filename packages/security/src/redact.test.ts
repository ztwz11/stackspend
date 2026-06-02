import { describe, expect, it } from "vitest";
import { redactProviderPayload, redactSensitiveString } from "./redact.js";

const FAKE_ACCOUNT_ID = "acct_fake_1234567890";
const FAKE_PROJECT_ID = "proj_fake_abcdef";
const FAKE_INVOICE_ID = "invoice_fake_9876543210";
const FAKE_EMAIL = "fake-dev@example.invalid";
const FAKE_TOKEN = "sk-test-fake-token-1234567890";
const FAKE_SLACK_WEBHOOK_URL = [
  "https://hooks.slack.com",
  "services",
  "TFAKE",
  "BFAKE",
  "CFAKE",
].join("/");

describe("redactSensitiveString", () => {
  it("redacts account IDs, project IDs, invoice IDs, emails, tokens, and webhook URLs", () => {
    const raw = [
      FAKE_ACCOUNT_ID,
      FAKE_PROJECT_ID,
      FAKE_INVOICE_ID,
      FAKE_EMAIL,
      FAKE_TOKEN,
      FAKE_SLACK_WEBHOOK_URL,
    ].join(" ");

    const redacted = redactSensitiveString(raw);

    expect(redacted).not.toContain(FAKE_ACCOUNT_ID);
    expect(redacted).not.toContain(FAKE_PROJECT_ID);
    expect(redacted).not.toContain(FAKE_INVOICE_ID);
    expect(redacted).not.toContain(FAKE_EMAIL);
    expect(redacted).not.toContain(FAKE_TOKEN);
    expect(redacted).not.toContain(FAKE_SLACK_WEBHOOK_URL);
    expect(redacted).toContain("[REDACTED:account_id]");
    expect(redacted).toContain("[REDACTED:project_id]");
    expect(redacted).toContain("[REDACTED:invoice_id]");
    expect(redacted).toContain("[REDACTED:email]");
    expect(redacted).toContain("[REDACTED:token]");
    expect(redacted).toContain("[REDACTED:webhook_url]");
  });
});

describe("redactProviderPayload", () => {
  it("recursively redacts sensitive fields while preserving safe scalar values", () => {
    const redacted = redactProviderPayload({
      accountId: "FAKE_ACCOUNT_ID_123",
      project_id: FAKE_PROJECT_ID,
      invoiceId: FAKE_INVOICE_ID,
      ownerEmail: FAKE_EMAIL,
      totalUsd: 42.5,
      nested: {
        token: FAKE_TOKEN,
        status: "ok",
      },
    });

    const serialized = JSON.stringify(redacted);

    expect(serialized).not.toContain("FAKE_ACCOUNT_ID_123");
    expect(serialized).not.toContain(FAKE_PROJECT_ID);
    expect(serialized).not.toContain(FAKE_INVOICE_ID);
    expect(serialized).not.toContain(FAKE_EMAIL);
    expect(serialized).not.toContain(FAKE_TOKEN);
    expect(redacted).toMatchObject({
      accountId: "[REDACTED:account_id]",
      project_id: "[REDACTED:project_id]",
      invoiceId: "[REDACTED:invoice_id]",
      ownerEmail: "[REDACTED:email]",
      totalUsd: 42.5,
      nested: {
        token: "[REDACTED:token]",
        status: "ok",
      },
    });
  });
});
