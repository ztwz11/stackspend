export type RedactedJsonValue =
  | null
  | string
  | number
  | boolean
  | RedactedJsonValue[]
  | { readonly [key: string]: RedactedJsonValue };

const STRING_REDACTION_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g, "[REDACTED:webhook_url]"],
  [/https:\/\/[^\s"')]+webhook[^\s"')]+/gi, "[REDACTED:webhook_url]"],
  [
    /\bAuthorization\s*:\s*(?:Bearer|Basic)?\s*[A-Za-z0-9._~+/=-]+\b/gi,
    "[REDACTED:authorization]",
  ],
  [
    /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|id[_-]?token|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*["']?[^"'\s,}&]+["']?/gi,
    "[REDACTED:token]",
  ],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED:email]"],
  [/\bacct[_-][A-Za-z0-9_-]+\b/g, "[REDACTED:account_id]"],
  [/\b(?:proj|project)[_-][A-Za-z0-9_-]+\b/g, "[REDACTED:project_id]"],
  [/\b(?:in|invoice)[_-][A-Za-z0-9_-]+\b/g, "[REDACTED:invoice_id]"],
  [/\b(?:card|payment)[_-][A-Za-z0-9_-]+\b/gi, "[REDACTED:card_data]"],
  [/\b(?:sk|sbp|xox[baprs])[-_][A-Za-z0-9_-]+\b/g, "[REDACTED:token]"],
];

export function redactSensitiveString(value: string): string {
  return STRING_REDACTION_RULES.reduce(
    (redacted, [pattern, replacement]) => redacted.replace(pattern, replacement),
    value,
  );
}

export function redactProviderPayload(value: unknown): RedactedJsonValue {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return redactSensitiveString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactProviderPayload(item));
  }

  if (!isRecord(value)) {
    return "[REDACTED:unsupported_value]";
  }

  const redacted: { [key: string]: RedactedJsonValue } = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    const keyMarker = redactionMarkerForKey(key);
    redacted[key] = keyMarker ?? redactProviderPayload(nestedValue);
  }

  return redacted;
}

export function redactionMarkerForKey(key: string): string | undefined {
  const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();

  if (normalizedKey.includes("slackwebhook") || normalizedKey.includes("webhookurl")) {
    return "[REDACTED:webhook_url]";
  }

  if (normalizedKey.includes("authorization")) {
    return "[REDACTED:authorization]";
  }

  if (normalizedKey.includes("email")) {
    return "[REDACTED:email]";
  }

  if (
    normalizedKey.includes("token") ||
    normalizedKey.includes("secret") ||
    normalizedKey.includes("apikey") ||
    normalizedKey.includes("accesskey")
  ) {
    return "[REDACTED:token]";
  }

  if (normalizedKey === "account" || normalizedKey.includes("accountid")) {
    return "[REDACTED:account_id]";
  }

  if (normalizedKey === "project" || normalizedKey.includes("projectid")) {
    return "[REDACTED:project_id]";
  }

  if (normalizedKey === "invoice" || normalizedKey.includes("invoiceid")) {
    return "[REDACTED:invoice_id]";
  }

  if (normalizedKey.includes("billingprofile")) {
    return "[REDACTED:billing_profile]";
  }

  if (normalizedKey.includes("card") || normalizedKey.includes("paymentmethod")) {
    return "[REDACTED:card_data]";
  }

  if (
    normalizedKey === "raw" ||
    normalizedKey === "rawpayload" ||
    normalizedKey === "rawresponse" ||
    normalizedKey === "providerpayload" ||
    normalizedKey === "providerresponse"
  ) {
    return "[REDACTED:raw_payload]";
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
