import { requireLocalSession } from "../../../../lib/local-security";
import { parseRefreshScope, refreshLocalLiveData } from "../../../../lib/local-hud-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
};

export async function POST(request: Request): Promise<Response> {
  try {
    requireLocalSession(request);
  } catch {
    return Response.json({
      error: "Local session and CSRF token are required.",
      localOnly: true,
      secretsReturned: false,
    }, {
      status: 403,
      headers: NO_STORE_HEADERS,
    });
  }

  const body = await readRequestBody(request);
  const scope = body === null
    ? "hud"
    : parseRefreshScope(body);

  if (scope === null) {
    return Response.json({
      error: "Refresh scope must be hud, local_ai, or all.",
      localOnly: true,
      secretsReturned: false,
    }, {
      status: 400,
      headers: NO_STORE_HEADERS,
    });
  }

  try {
    return Response.json(await refreshLocalLiveData({ scope }), {
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return Response.json({
      error: "Local live refresh failed.",
      localOnly: true,
      secretsReturned: false,
    }, {
      status: 500,
      headers: NO_STORE_HEADERS,
    });
  }
}

async function readRequestBody(request: Request): Promise<unknown | null> {
  const text = await request.text();

  if (text.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}
