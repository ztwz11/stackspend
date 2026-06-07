import { createLocalSession, isLocalRequest, localSessionCookie } from "../../../../lib/local-security";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isLocalRequest(request)) {
    return Response.json(
      {
        error: "Local dashboard session requires localhost.",
      },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const session = createLocalSession();

  return Response.json(
    {
      csrfToken: session.csrfToken,
      expiresAt: new Date(session.expiresAt).toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": localSessionCookie(session),
      },
    },
  );
}
