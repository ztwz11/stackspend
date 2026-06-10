import { describe, expect, it } from "vitest";
import { redactProviderPayload, redactSensitiveString } from "./redact.js";

const FAKE_ACCOUNT_ID = "acct_fake_1234567890";
const FAKE_PROJECT_ID = "proj_fake_abcdef";
const FAKE_INVOICE_ID = "invoice_fake_9876543210";
const FAKE_EMAIL = "fake-dev@example.invalid";
const FAKE_TOKEN = "sk-test-fake-token-1234567890";
const FAKE_REFRESH_TOKEN = "fake-refresh-token-for-tests";
const FAKE_CLIENT_SECRET = "fake-client-secret-for-tests";
const FAKE_AWS_SECRET_ACCESS_KEY = "FAKE_AWS_SECRET_ACCESS_KEY_FOR_TESTS";
const FAKE_AUTHORIZATION_TOKEN = "fake-authorization-token-for-tests";
const FAKE_CARD_REF = "card_fake_4242";
const FAKE_SLACK_WEBHOOK_URL = [
  "https://hooks.slack.com",
  "services",
  "TFAKE",
  "BFAKE",
  "CFAKE",
].join("/");

describe("redactSensitiveString", () => {
  it("redacts account IDs, project IDs, invoice IDs, emails, tokens, cards, and webhook URLs", () => {
    const raw = [
      FAKE_ACCOUNT_ID,
      FAKE_PROJECT_ID,
      FAKE_INVOICE_ID,
      FAKE_EMAIL,
      FAKE_TOKEN,
      FAKE_CARD_REF,
      FAKE_SLACK_WEBHOOK_URL,
    ].join(" ");

    const redacted = redactSensitiveString(raw);

    expect(redacted).not.toContain(FAKE_ACCOUNT_ID);
    expect(redacted).not.toContain(FAKE_PROJECT_ID);
    expect(redacted).not.toContain(FAKE_INVOICE_ID);
    expect(redacted).not.toContain(FAKE_EMAIL);
    expect(redacted).not.toContain(FAKE_TOKEN);
    expect(redacted).not.toContain(FAKE_CARD_REF);
    expect(redacted).not.toContain(FAKE_SLACK_WEBHOOK_URL);
    expect(redacted).toContain("[REDACTED:account_id]");
    expect(redacted).toContain("[REDACTED:project_id]");
    expect(redacted).toContain("[REDACTED:invoice_id]");
    expect(redacted).toContain("[REDACTED:email]");
    expect(redacted).toContain("[REDACTED:token]");
    expect(redacted).toContain("[REDACTED:card_data]");
    expect(redacted).toContain("[REDACTED:webhook_url]");
  });

  it("redacts key-value API credentials and Authorization headers", () => {
    const raw = [
      `api_key=${FAKE_TOKEN}`,
      `refresh_token=${FAKE_REFRESH_TOKEN}`,
      `client_secret=${FAKE_CLIENT_SECRET}`,
      `AWS_SECRET_ACCESS_KEY=${FAKE_AWS_SECRET_ACCESS_KEY}`,
      `Authorization: Bearer ${FAKE_AUTHORIZATION_TOKEN}`,
    ].join("\n");

    const redacted = redactSensitiveString(raw);

    expect(redacted).not.toContain(FAKE_TOKEN);
    expect(redacted).not.toContain(FAKE_REFRESH_TOKEN);
    expect(redacted).not.toContain(FAKE_CLIENT_SECRET);
    expect(redacted).not.toContain(FAKE_AWS_SECRET_ACCESS_KEY);
    expect(redacted).not.toContain(FAKE_AUTHORIZATION_TOKEN);
    expect(redacted).toContain("[REDACTED:token]");
    expect(redacted).toContain("[REDACTED:authorization]");
  });
});

describe("redactProviderPayload", () => {
  it("recursively redacts sensitive fields while preserving safe scalar values", () => {
    const redacted = redactProviderPayload({
      accountId: "FAKE_ACCOUNT_ID_123",
      account: FAKE_ACCOUNT_ID,
      authorization: `Bearer ${FAKE_AUTHORIZATION_TOKEN}`,
      project_id: FAKE_PROJECT_ID,
      invoiceId: FAKE_INVOICE_ID,
      ownerEmail: FAKE_EMAIL,
      client_secret: FAKE_CLIENT_SECRET,
      refresh_token: FAKE_REFRESH_TOKEN,
      paymentMethodCard: FAKE_CARD_REF,
      rawPayload: {
        untouched: false,
      },
      totalUsd: 42.5,
      nested: {
        token: FAKE_TOKEN,
        status: "ok",
      },
    });

    const serialized = JSON.stringify(redacted);

    expect(serialized).not.toContain("FAKE_ACCOUNT_ID_123");
    expect(serialized).not.toContain(FAKE_ACCOUNT_ID);
    expect(serialized).not.toContain(FAKE_AUTHORIZATION_TOKEN);
    expect(serialized).not.toContain(FAKE_PROJECT_ID);
    expect(serialized).not.toContain(FAKE_INVOICE_ID);
    expect(serialized).not.toContain(FAKE_EMAIL);
    expect(serialized).not.toContain(FAKE_CLIENT_SECRET);
    expect(serialized).not.toContain(FAKE_REFRESH_TOKEN);
    expect(serialized).not.toContain(FAKE_CARD_REF);
    expect(serialized).not.toContain(FAKE_TOKEN);
    expect(redacted).toMatchObject({
      accountId: "[REDACTED:account_id]",
      account: "[REDACTED:account_id]",
      authorization: "[REDACTED:authorization]",
      project_id: "[REDACTED:project_id]",
      invoiceId: "[REDACTED:invoice_id]",
      ownerEmail: "[REDACTED:email]",
      client_secret: "[REDACTED:token]",
      refresh_token: "[REDACTED:token]",
      paymentMethodCard: "[REDACTED:card_data]",
      rawPayload: "[REDACTED:raw_payload]",
      totalUsd: 42.5,
      nested: {
        token: "[REDACTED:token]",
        status: "ok",
      },
    });
  });
});
