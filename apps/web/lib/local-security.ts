import { createHash, randomBytes } from "node:crypto";

export interface LocalSession {
  sessionId: string;
  csrfToken: string;
  expiresAt: number;
}

export interface OAuthTransaction {
  provider: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
  redirectUri: string;
  sessionId: string;
  expiresAt: number;
}

const SESSION_COOKIE = "stackspend_session";
const SESSION_TTL_MS = 30 * 60 * 1000;
const OAUTH_TTL_MS = 10 * 60 * 1000;
const sessions = new Map<string, LocalSession>();
const oauthTransactions = new Map<string, OAuthTransaction>();

export function createLocalSession(now: Date = new Date()): LocalSession {
  pruneExpired(now);
  const session: LocalSession = {
    sessionId: randomToken(32),
    csrfToken: randomToken(32),
    expiresAt: now.getTime() + SESSION_TTL_MS,
  };
  sessions.set(session.sessionId, session);

  return session;
}

export function localSessionCookie(session: LocalSession): string {
  return [
    `${SESSION_COOKIE}=${session.sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=1800",
  ].join("; ");
}

export function requireLocalSession(request: Request, now: Date = new Date()): LocalSession {
  pruneExpired(now);

  if (!isLocalRequest(request)) {
    throw new Error("Request must originate from localhost.");
  }

  const sessionId = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  const csrfToken = request.headers.get("x-stackspend-csrf")?.trim();

  if (sessionId === undefined || csrfToken === undefined || csrfToken.length === 0) {
    throw new Error("Local session and CSRF token are required.");
  }

  const session = sessions.get(sessionId);

  if (session === undefined || session.expiresAt <= now.getTime() || session.csrfToken !== csrfToken) {
    throw new Error("Local session is invalid.");
  }

  return session;
}

export function isLocalRequest(request: Request): boolean {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  return isLocalHostHeader(host) &&
    (origin === null || isLocalUrl(origin)) &&
    (referer === null || isLocalUrl(referer));
}

export function createOAuthTransaction(options: {
  provider: string;
  request: Request;
  session: LocalSession;
  now?: Date;
}): OAuthTransaction {
  const now = options.now ?? new Date();
  const state = randomToken(32);
  const codeVerifier = randomToken(48);
  const transaction: OAuthTransaction = {
    provider: options.provider,
    state,
    nonce: randomToken(32),
    codeVerifier,
    codeChallenge: createPkceChallenge(codeVerifier),
    redirectUri: localCallbackUrl(options.request, options.provider),
    sessionId: options.session.sessionId,
    expiresAt: now.getTime() + OAUTH_TTL_MS,
  };
  oauthTransactions.set(state, transaction);

  return transaction;
}

export function consumeOAuthTransaction(
  provider: string,
  state: string,
  now: Date = new Date(),
): OAuthTransaction {
  pruneExpired(now);
  const transaction = oauthTransactions.get(state);

  if (transaction === undefined || transaction.provider !== provider || transaction.expiresAt <= now.getTime()) {
    throw new Error("OAuth transaction is invalid.");
  }

  oauthTransactions.delete(state);

  return transaction;
}

export function clearLocalSecurityState(): void {
  sessions.clear();
  oauthTransactions.clear();
}

function pruneExpired(now: Date): void {
  const nowMs = now.getTime();

  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt <= nowMs) {
      sessions.delete(sessionId);
    }
  }

  for (const [state, transaction] of oauthTransactions.entries()) {
    if (transaction.expiresAt <= nowMs) {
      oauthTransactions.delete(state);
    }
  }
}

function localCallbackUrl(request: Request, provider: string): string {
  const host = request.headers.get("host") ?? "127.0.0.1:3000";

  if (!isLocalHostHeader(host)) {
    throw new Error("OAuth callback host must be localhost.");
  }

  return `http://${host}/api/auth/callback/${provider}`;
}

function isLocalHostHeader(host: string | null): boolean {
  if (host === null || host.trim().length === 0) {
    return false;
  }

  const normalized = host.trim().toLowerCase();
  const hostname = normalized.startsWith("[")
    ? normalized.slice(1, normalized.indexOf("]"))
    : normalized.split(":")[0] ?? normalized;

  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function isLocalUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return isLocalHostHeader(url.host);
  } catch {
    return false;
  }
}

function parseCookies(header: string | null): Record<string, string> {
  if (header === null) {
    return {};
  }

  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");

        return separator === -1
          ? [part, ""]
          : [part.slice(0, separator), part.slice(separator + 1)];
      }),
  );
}

function createPkceChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

function randomToken(byteLength: number): string {
  return randomBytes(byteLength).toString("base64url");
}
