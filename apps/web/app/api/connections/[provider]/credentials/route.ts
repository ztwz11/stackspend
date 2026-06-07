import { deleteCredential, setCredential, type CredentialAuthMethod } from "../../../../../../../packages/credentials/src/index";
import { readConnectionsStatus } from "../../../../../lib/connection-status";
import { requireLocalSession } from "../../../../../lib/local-security";
import { type ProviderKey, AVAILABLE_PROVIDER_KEYS } from "../../../../../lib/provider-catalog";

interface RouteContext {
  params: Promise<{
    provider: string;
  }>;
}

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    requireLocalSession(request);
    const provider = await readProvider(context.params);
    const input = await readCredentialInput(request, provider);

    await setCredential(provider, "read-only", input);

    return providerStatusResponse(provider);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    requireLocalSession(request);
    const provider = await readProvider(context.params);

    await deleteCredential(provider, "read-only");

    return providerStatusResponse(provider);
  } catch (error) {
    return errorResponse(error);
  }
}

async function readProvider(params: RouteContext["params"]): Promise<ProviderKey> {
  const { provider } = await params;

  if (!AVAILABLE_PROVIDER_KEYS.includes(provider as ProviderKey)) {
    throw new Error("Unsupported provider.");
  }

  return provider as ProviderKey;
}

async function readCredentialInput(
  request: Request,
  provider: ProviderKey,
): Promise<{
  secret: string;
  authMethod: CredentialAuthMethod;
  metadata?: Record<string, string>;
}> {
  if (provider === "aws") {
    throw new Error("AWS raw access keys are not stored by StackSpend. Use AWS_PROFILE or SDK SSO setup.");
  }

  const body = await request.json() as Record<string, unknown>;
  const secret = readRequiredString(body.secret, "Credential secret");

  if (provider === "openai") {
    return {
      secret,
      authMethod: "api_key",
    };
  }

  if (provider === "supabase") {
    return {
      secret,
      authMethod: "pat",
    };
  }

  const accountIds = readRequiredString(body.accountIds, "Cloudflare account IDs");

  return {
    secret,
    authMethod: "api_token",
    metadata: {
      accountIds,
    },
  };
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length < 8) {
    throw new Error(`${label} must be at least 8 characters.`);
  }

  return value.trim();
}

async function providerStatusResponse(provider: ProviderKey): Promise<Response> {
  const status = await readConnectionsStatus();
  const providerStatus = status.providers.find((item) => item.providerKey === provider);

  return Response.json(
    {
      provider: providerStatus,
      secretsReturned: false,
      providerWriteActionsEnabled: false,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function errorResponse(error: unknown): Response {
  return Response.json(
    {
      error: error instanceof Error ? error.message : "Credential operation failed.",
    },
    {
      status: 400,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
