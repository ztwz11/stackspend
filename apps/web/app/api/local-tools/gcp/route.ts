import { readGcpLocalSetupStatus } from "../../../../lib/local-tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const status = await readGcpLocalSetupStatus();

    return Response.json(status, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        error: "Google Cloud local setup status unavailable.",
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
