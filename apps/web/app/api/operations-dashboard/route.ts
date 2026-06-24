import { readOperationsDashboard } from "../../../lib/operations-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
};

export async function GET(): Promise<Response> {
  try {
    return Response.json(await readOperationsDashboard(), {
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return Response.json(
      {
        error: "Operations dashboard unavailable.",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      },
    );
  }
}
