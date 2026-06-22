import { isLocalRequest } from "../../../../lib/local-security";
import { readLocalHudViewModel } from "../../../../lib/local-hud-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
};

export async function GET(request: Request): Promise<Response> {
  if (!isLocalRequest(request)) {
    return Response.json({
      error: "Request must originate from localhost.",
      localOnly: true,
      secretsReturned: false,
    }, {
      status: 403,
      headers: NO_STORE_HEADERS,
    });
  }

  try {
    return Response.json(await readLocalHudViewModel(), {
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return Response.json({
      error: "HUD model unavailable.",
      localOnly: true,
      secretsReturned: false,
    }, {
      status: 500,
      headers: NO_STORE_HEADERS,
    });
  }
}
