import { requireLocalSession } from "../../../../../lib/local-security";
import { setAwsProfileGlobally } from "../../../../../lib/local-tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    requireLocalSession(request);
    const body = await request.json() as Record<string, unknown>;
    const profileName = typeof body.profileName === "string" ? body.profileName : "";
    const result = await setAwsProfileGlobally(profileName);

    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (caught) {
    return Response.json(
      {
        error: caught instanceof Error ? caught.message : "AWS_PROFILE was not saved.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
