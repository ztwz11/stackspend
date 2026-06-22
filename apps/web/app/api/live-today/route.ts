import { readLiveTodaySnapshot, refreshLiveToday } from "../../../lib/live-today";
import { isLocalRequest, requireLocalSession } from "../../../lib/local-security";
import { parseRefreshScope } from "../../../lib/local-hud-model";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function GET(request: Request = new Request("http://127.0.0.1:3000/api/live-today", {
  headers: {
    host: "127.0.0.1:3000",
  },
})): Promise<Response> {
  if (!isLocalRequest(request)) {
    return Response.json(
      {
        error: "Live today cache is local-only.",
        localOnly: true,
        secretsReturned: false,
      },
      {
        status: 403,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  try {
    return Response.json(await readLiveTodaySnapshot(), {
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return Response.json(
      {
        error: "Live today cache unavailable.",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireLocalSession(request);
  } catch {
    return Response.json(
      {
        error: "Local session and CSRF token are required.",
        localOnly: true,
        secretsReturned: false,
      },
      {
        status: 403,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  const body = await readRequestBody(request);
  const scope = body === null ? "all" : parseRefreshScope(body);

  if (scope === null) {
    return Response.json(
      {
        error: "Refresh scope must be hud, local_ai, or all.",
        localOnly: true,
        secretsReturned: false,
      },
      {
        status: 400,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  try {
    return Response.json(await refreshLiveToday({ scope }), {
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return Response.json(
      {
        error: "Live today refresh failed.",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      },
    );
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
