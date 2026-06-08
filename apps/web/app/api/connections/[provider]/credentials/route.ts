import {
  deleteCredential,
  setCredential,
  testCredentialStore,
  type CredentialAuthMethod,
} from "../../../../../../../packages/credentials/src/index";
import { readConnectionsStatus } from "../../../../../lib/connection-status";
import { validateReadOnlyCredential } from "../../../../../lib/credential-validation";
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
    await assertCredentialStoreWritable();
    const validation = await validateReadOnlyCredential(provider, {
      secret: input.secret,
      ...(input.metadata?.accountIds === undefined ? {} : { accountIds: input.metadata.accountIds }),
    });

    const credential = await setCredential(provider, "read-only", {
      ...input,
      metadata: {
        ...(input.metadata ?? {}),
        validatedAt: validation.validatedAt,
      },
    });

    return providerStatusResponse(provider, credential.connectionId);
  } catch (error) {
    return errorResponse(error);
  }
}

async function assertCredentialStoreWritable(): Promise<void> {
  const health = await testCredentialStore();

  if (!health.writable) {
    const reason = health.reason ?? "Credential store is not writable.";
    const hint = health.backend === "encrypted_vault"
      ? "Set STACKSPEND_CREDENTIAL_VAULT_PASSPHRASE before starting the local web server, or configure the OS keychain backend."
      : "Check the local credential store backend configuration.";

    throw new Error(`${reason} ${hint}`);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    requireLocalSession(request);
    const provider = await readProvider(context.params);
    const connectionId = readConnectionId(request);

    await deleteCredential(provider, "read-only", { connectionId });

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
  label: string;
  metadata?: Record<string, string>;
}> {
  if (provider === "aws") {
    throw new Error("AWS raw access keys are not stored by StackSpend. Use AWS_PROFILE or SDK SSO setup.");
  }

  const body = await request.json() as Record<string, unknown>;
  const secret = readRequiredString(body.secret, "Credential secret");
  const label = readOptionalString(body.label, "Connection label") ?? defaultConnectionLabel(provider);

  if (provider === "openai") {
    return {
      secret,
      label,
      authMethod: "api_key",
    };
  }

  if (provider === "supabase") {
    return {
      secret,
      label,
      authMethod: "pat",
    };
  }

  const accountIds = readRequiredString(body.accountIds, "Cloudflare account IDs");

  return {
    secret,
    label,
    authMethod: "api_token",
    metadata: {
      accountIds,
    },
  };
}

function readConnectionId(request: Request): string {
  const connectionId = new URL(request.url).searchParams.get("connectionId")?.trim();

  if (connectionId === undefined || connectionId.length === 0) {
    throw new Error("Connection id is required.");
  }

  return connectionId;
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length < 8) {
    throw new Error(`${label} must be at least 8 characters.`);
  }

  return value.trim();
}

function readOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > 80) {
    throw new Error(`${label} must be 1-80 characters.`);
  }

  return value.trim();
}

function defaultConnectionLabel(provider: ProviderKey): string {
  if (provider === "openai") {
    return "OpenAI";
  }

  if (provider === "supabase") {
    return "Supabase";
  }

  if (provider === "cloudflare") {
    return "Cloudflare";
  }

  return "Default";
}

async function providerStatusResponse(provider: ProviderKey, connectionId?: string): Promise<Response> {
  const status = await readConnectionsStatus();
  const providerStatus = status.providers.find((item) => item.providerKey === provider);

  return Response.json(
    {
      provider: providerStatus,
      ...(connectionId === undefined ? {} : { connectionId }),
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
