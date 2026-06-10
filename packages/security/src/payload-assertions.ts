import { redactSensitiveString, redactionMarkerForKey } from "./redact.js";

export interface SensitivePayloadLeak {
  readonly path: string;
  readonly category: string;
  readonly evidence: string;
}

const REDACTION_MARKER_PATTERN = /\[REDACTED:[^\]]+\]/;
const SAFE_FALSE_FLAGS = new Set(["secretsreturned", "rawpersisted"]);
const SAFE_NUMERIC_TOKEN_FIELDS = new Set([
  "tokens",
  "tokencount",
  "inputtokens",
  "outputtokens",
  "totaltokens",
]);

export function findSensitivePayloadLeaks(value: unknown): SensitivePayloadLeak[] {
  const leaks: SensitivePayloadLeak[] = [];
  collectLeaks(value, "$", leaks);

  return leaks;
}

export function assertNoSensitivePayloadLeaks(value: unknown): void {
  const leaks = findSensitivePayloadLeaks(value);

  if (leaks.length > 0) {
    const summary = leaks
      .slice(0, 5)
      .map((leak) => `${leak.path} ${leak.category}`)
      .join(", ");

    throw new Error(`Sensitive payload content detected: ${summary}`);
  }
}

function collectLeaks(value: unknown, path: string, leaks: SensitivePayloadLeak[]): void {
  if (typeof value === "string") {
    const redacted = redactSensitiveString(value);

    if (redacted !== value && REDACTION_MARKER_PATTERN.test(redacted)) {
      leaks.push({
        path,
        category: "sensitive_string",
        evidence: redactionEvidence(redacted),
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectLeaks(item, `${path}[${index}]`, leaks));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    const normalizedKey = normalizeKey(key);

    if (SAFE_FALSE_FLAGS.has(normalizedKey) && nestedValue === false) {
      continue;
    }

    if (SAFE_NUMERIC_TOKEN_FIELDS.has(normalizedKey) && typeof nestedValue === "number") {
      continue;
    }

    if (normalizedKey === "secretsreturned" && nestedValue !== false) {
      leaks.push({
        path: nestedPath,
        category: "secret_disclosure_flag",
        evidence: "secretsReturned",
      });
    } else if (normalizedKey === "rawpersisted" && nestedValue !== false) {
      leaks.push({
        path: nestedPath,
        category: "raw_persistence_flag",
        evidence: "rawPersisted",
      });
    } else {
      const keyMarker = redactionMarkerForKey(key);

      if (keyMarker !== undefined) {
        leaks.push({
          path: nestedPath,
          category: "sensitive_key",
          evidence: keyMarker,
        });
      }
    }

    collectLeaks(nestedValue, nestedPath, leaks);
  }
}

function redactionEvidence(value: string): string {
  return value.match(REDACTION_MARKER_PATTERN)?.[0] ?? "[REDACTED]";
}

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
