import { readConnectionsStatus } from "../../../../lib/connection-status";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const status = await readConnectionsStatus();

    return Response.json(status, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        error: "Connection status unavailable.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
