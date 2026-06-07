import { consumeOAuthTransaction, isLocalRequest } from "../../../../../lib/local-security";
import { AVAILABLE_PROVIDER_KEYS, type ProviderKey } from "../../../../../lib/provider-catalog";

interface RouteContext {
  params: Promise<{
    provider: string;
  }>;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    if (!isLocalRequest(request)) {
      throw new Error("OAuth callback must use localhost.");
    }

    const provider = await readProvider(context.params);
    const url = new URL(request.url);
    const state = url.searchParams.get("state")?.trim();
    const code = url.searchParams.get("code")?.trim();

    if (state === undefined || state.length === 0 || code === undefined || code.length === 0) {
      throw new Error("OAuth callback is missing state or code.");
    }

    consumeOAuthTransaction(provider, state);

    return Response.json(
      {
        provider,
        status: "oauth_callback_received",
        credentialStored: false,
        secretsReturned: false,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "OAuth callback failed.",
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

async function readProvider(params: RouteContext["params"]): Promise<ProviderKey> {
  const { provider } = await params;

  if (!AVAILABLE_PROVIDER_KEYS.includes(provider as ProviderKey)) {
    throw new Error("Unsupported provider.");
  }

  return provider as ProviderKey;
}
