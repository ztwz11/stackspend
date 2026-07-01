import { spawn } from "node:child_process";
import { isLocalRequest } from "../../../../lib/local-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
};

export async function POST(request: Request): Promise<Response> {
  if (!isLocalRequest(request)) {
    return Response.json({
      error: "Request must originate from localhost.",
      localOnly: true,
      secretsReturned: false,
    }, {
      status: 400,
      headers: NO_STORE_HEADERS,
    });
  }

  const body = await readRequestBody(request);
  const path = isRecord(body) && typeof body.path === "string"
    ? sanitizeDashboardRoutePath(body.path)
    : null;

  if (path === null) {
    return Response.json({
      error: "A safe local route path is required.",
      localOnly: true,
      secretsReturned: false,
    }, {
      status: 400,
      headers: NO_STORE_HEADERS,
    });
  }

  try {
    openExternalUrl(new URL(path, request.url).toString());

    return Response.json({
      generatedAt: new Date().toISOString(),
      localOnly: true,
      secretsReturned: false,
      status: "opened",
    }, {
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return Response.json({
      error: "Failed to open the local dashboard route.",
      localOnly: true,
      secretsReturned: false,
    }, {
      status: 500,
      headers: NO_STORE_HEADERS,
    });
  }
}

async function readRequestBody(request: Request): Promise<unknown> {
  try {
    return JSON.parse(await request.text()) as unknown;
  } catch {
    return {};
  }
}

function sanitizeDashboardRoutePath(path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//")) {
    return null;
  }

  if (/[\u0000-\u001f\u007f]/.test(path)) {
    return null;
  }

  return path;
}

function openExternalUrl(url: string): void {
  const command = process.platform === "win32"
    ? "explorer.exe"
    : process.platform === "darwin"
      ? "open"
      : "xdg-open";
  const child = spawn(command, [url], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });

  child.unref();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
