import { createAwsCostExplorerConnector, createAwsSdkCostExplorerClient } from "../../../packages/connectors/aws/src/index";
import {
  createOpenAiUsageCostsClient,
  createOpenAiUsageCostsConnector,
} from "../../../packages/connectors/openai/src/index";
import {
  createSupabaseManagementClient,
  createSupabaseUsageHealthConnector,
} from "../../../packages/connectors/supabase/src/index";
import {
  createCloudflareBillingUsageClient,
  createCloudflareBillingUsageConnector,
} from "../../../packages/connectors/cloudflare/src/index";
import {
  createDefaultCredentialStore,
  type CredentialStore,
} from "../../../packages/credentials/src/index";
import {
  readConnectionsStatus,
  type ConnectionsStatusPayload,
  type ProviderConnectionStatus,
} from "./connection-status";
import {
  AVAILABLE_PROVIDER_KEYS,
  findAvailableProvider,
  type LiveGranularity,
  type ProviderKey,
} from "./provider-catalog";

export type LiveTodayFreshness = "live" | "stale" | "error" | "unavailable" | "not_configured" | "locked";
export type LiveTodayConfidence = "high" | "medium" | "low" | "none";
export type LiveTodayCollectionStatus = "ok" | "partial" | "error";

export interface LiveTodayProviderSnapshot {
  providerKey: ProviderKey;
  checkedAt: string | null;
  expiresAt: string | null;
  ttlSeconds: number;
  freshness: LiveTodayFreshness;
  liveGranularity: LiveGranularity;
  confidence: LiveTodayConfidence;
  provisional: true;
  todayLiveAmountMinor: number | null;
  currency: string;
  included: boolean;
  status: LiveTodayCollectionStatus | "not_checked";
  message?: string;
}

export interface LiveTodaySnapshot {
  generatedAt: string;
  ttlSeconds: number;
  cacheState: "empty" | "fresh" | "stale";
  providers: readonly LiveTodayProviderSnapshot[];
}

export interface LiveTodayProviderCollection {
  providerKey: ProviderKey;
  status: LiveTodayCollectionStatus;
  checkedAt: string;
  todayLiveAmountMinor: number | null;
  currency: string;
  included: boolean;
  confidence: LiveTodayConfidence;
  message?: string;
}

export type LiveTodayProviderCollector = (
  context: LiveTodayCollectionContext,
) => Promise<LiveTodayProviderCollection>;

export interface LiveTodayCollectionContext {
  providerKey: ProviderKey;
  connection: ProviderConnectionStatus;
  env: Record<string, string | undefined>;
  credentialStore: CredentialStore;
  now: Date;
  timezone: string;
}

export interface LiveTodayOptions {
  env?: Record<string, string | undefined>;
  now?: () => Date;
  timezone?: string;
  ttlSeconds?: number;
  connections?: ConnectionsStatusPayload;
  credentialStore?: CredentialStore;
  collectors?: Partial<Record<ProviderKey, LiveTodayProviderCollector>>;
}

const DEFAULT_TTL_SECONDS = 60;
const AWS_REGION_ENV_KEY = "STACKSPEND_AWS_REGION";
const CLOUDFLARE_ACCOUNT_IDS_ENV_KEY = "CLOUDFLARE_ACCOUNT_IDS";
const cache = new Map<ProviderKey, CachedLiveTodayProvider>();

interface CachedLiveTodayProvider extends LiveTodayProviderCollection {
  expiresAt: string;
}

export async function readLiveTodaySnapshot(options: LiveTodayOptions = {}): Promise<LiveTodaySnapshot> {
  const context = await createLiveTodayContext(options);
  const providers = context.connections.providers.map((connection) => {
    const cached = cache.get(connection.providerKey);

    if (cached === undefined) {
      return notCheckedSnapshot(connection, context.ttlSeconds);
    }

    return snapshotFromCachedProvider(connection, cached, context.now, context.ttlSeconds);
  });

  return {
    generatedAt: context.now.toISOString(),
    ttlSeconds: context.ttlSeconds,
    cacheState: summarizeCacheState(providers),
    providers,
  };
}

export async function refreshLiveToday(options: LiveTodayOptions = {}): Promise<LiveTodaySnapshot> {
  const context = await createLiveTodayContext(options);

  await Promise.all(
    context.connections.providers.map(async (connection) => {
      const providerKey = connection.providerKey;
      const checkedAt = context.now.toISOString();
      const preflight = preflightProvider(connection);

      if (preflight !== null) {
        cache.set(providerKey, {
          providerKey,
          status: "partial",
          checkedAt,
          expiresAt: expiresAt(context.now, context.ttlSeconds),
          todayLiveAmountMinor: null,
          currency: "USD",
          included: false,
          confidence: "none",
          message: preflight,
        });
        return;
      }

      const collector = context.collectors[providerKey] ?? createDefaultLiveTodayCollector(providerKey);

      try {
        const collected = await collector({
          providerKey,
          connection,
          env: context.env,
          credentialStore: context.credentialStore,
          now: context.now,
          timezone: context.timezone,
        });
        cache.set(providerKey, {
          ...collected,
          expiresAt: expiresAt(context.now, context.ttlSeconds),
        });
      } catch (error) {
        cache.set(providerKey, {
          providerKey,
          status: "error",
          checkedAt,
          expiresAt: expiresAt(context.now, context.ttlSeconds),
          todayLiveAmountMinor: null,
          currency: "USD",
          included: false,
          confidence: "none",
          message: safeErrorMessage(error),
        });
      }
    }),
  );

  return readLiveTodaySnapshot({
    ...options,
    connections: context.connections,
    credentialStore: context.credentialStore,
    now: () => context.now,
  });
}

export function clearLiveTodayCache(): void {
  cache.clear();
}

async function createLiveTodayContext(options: LiveTodayOptions): Promise<RequiredLiveTodayContext> {
  const env = options.env ?? process.env;
  const now = options.now?.() ?? new Date();
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const credentialStore = options.credentialStore ?? createDefaultCredentialStore({
    env,
    now: () => now,
  });
  const connections = options.connections ?? await readConnectionsStatus({
    env,
    credentialStore,
    now: () => now,
  });

  return {
    env,
    now,
    ttlSeconds,
    timezone: options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
    connections,
    credentialStore,
    collectors: options.collectors ?? {},
  };
}

interface RequiredLiveTodayContext {
  env: Record<string, string | undefined>;
  now: Date;
  ttlSeconds: number;
  timezone: string;
  connections: ConnectionsStatusPayload;
  credentialStore: CredentialStore;
  collectors: Partial<Record<ProviderKey, LiveTodayProviderCollector>>;
}

function preflightProvider(connection: ProviderConnectionStatus): string | null {
  if (connection.connectionState === "not_configured") {
    return "Provider credentials are not configured.";
  }

  if (connection.connectionState === "locked") {
    return "Credential store is locked.";
  }

  if (connection.connectionState === "expired" || connection.connectionState === "invalid") {
    return "Provider credentials are not valid for live checks.";
  }

  if (findAvailableProvider(connection.providerKey)?.liveGranularity === "unavailable") {
    return "Provider does not support live today checks.";
  }

  return null;
}

function notCheckedSnapshot(
  connection: ProviderConnectionStatus,
  ttlSeconds: number,
): LiveTodayProviderSnapshot {
  const granularity = findAvailableProvider(connection.providerKey)?.liveGranularity ?? "unavailable";

  return {
    providerKey: connection.providerKey,
    checkedAt: null,
    expiresAt: null,
    ttlSeconds,
    freshness: freshnessWithoutCache(connection, granularity),
    liveGranularity: granularity,
    confidence: "none",
    provisional: true,
    todayLiveAmountMinor: null,
    currency: "USD",
    included: false,
    status: "not_checked",
  };
}

function snapshotFromCachedProvider(
  connection: ProviderConnectionStatus,
  cached: CachedLiveTodayProvider,
  now: Date,
  ttlSeconds: number,
): LiveTodayProviderSnapshot {
  const granularity = findAvailableProvider(connection.providerKey)?.liveGranularity ?? "unavailable";
  const expired = new Date(cached.expiresAt).getTime() <= now.getTime();
  const freshness = cached.status === "partial" && cached.confidence === "none" && cached.todayLiveAmountMinor === null
    ? freshnessWithoutCache(connection, granularity)
    : cached.status === "error"
    ? "error"
    : expired
      ? "stale"
      : "live";

  return {
    providerKey: connection.providerKey,
    checkedAt: cached.checkedAt,
    expiresAt: cached.expiresAt,
    ttlSeconds,
    freshness,
    liveGranularity: granularity,
    confidence: expired || cached.status === "error" ? "none" : cached.confidence,
    provisional: true,
    todayLiveAmountMinor: cached.todayLiveAmountMinor,
    currency: cached.currency,
    included: !expired && cached.status !== "error" && cached.included,
    status: cached.status,
    ...(cached.message === undefined ? {} : { message: cached.message }),
  };
}

function freshnessWithoutCache(
  connection: ProviderConnectionStatus,
  granularity: LiveGranularity,
): LiveTodayFreshness {
  if (connection.connectionState === "locked") {
    return "locked";
  }

  if (connection.connectionState === "not_configured") {
    return "not_configured";
  }

  if (connection.connectionState === "expired" || connection.connectionState === "invalid") {
    return "error";
  }

  if (granularity === "unavailable") {
    return "unavailable";
  }

  return "stale";
}

function summarizeCacheState(providers: readonly LiveTodayProviderSnapshot[]): LiveTodaySnapshot["cacheState"] {
  if (providers.every((provider) => provider.checkedAt === null)) {
    return "empty";
  }

  if (providers.some((provider) => provider.freshness === "live")) {
    return "fresh";
  }

  return "stale";
}

function createDefaultLiveTodayCollector(providerKey: ProviderKey): LiveTodayProviderCollector {
  if (providerKey === "aws") {
    return collectAwsLiveToday;
  }

  if (providerKey === "openai") {
    return collectOpenAiLiveToday;
  }

  if (providerKey === "supabase") {
    return collectSupabaseLiveToday;
  }

  return collectCloudflareLiveToday;
}

async function collectAwsLiveToday(context: LiveTodayCollectionContext): Promise<LiveTodayProviderCollection> {
  const connector = createAwsCostExplorerConnector({
    costExplorerClient: createAwsSdkCostExplorerClient(awsSdkOptionsFromEnv(context.env)),
  });
  const collection = await connector.collect({
    now: () => context.now,
  });
  const estimate = summarizeAmount(collection.snapshots.costEstimates);

  return {
    providerKey: "aws",
    status: collection.status,
    checkedAt: collection.collectedAt,
    todayLiveAmountMinor: estimate.amountMinor,
    currency: estimate.currency,
    included: false,
    confidence: "medium",
    message: "AWS Cost Explorer exposes the current billing period, not exact current-day cost.",
  };
}

async function collectOpenAiLiveToday(context: LiveTodayCollectionContext): Promise<LiveTodayProviderCollection> {
  const credential = await resolveProviderSecret(context, "openai");
  const connector = createOpenAiUsageCostsConnector({
    client: createOpenAiUsageCostsClient({
      adminKey: credential.secret,
    }),
  });
  const collection = await connector.collect({
    now: () => context.now,
  });
  const today = dateKeyInTimezone(context.now, context.timezone);
  const todayEstimate = summarizeAmount(
    collection.snapshots.costEstimates.filter((estimate) => estimate.periodStart === today),
  );

  return {
    providerKey: "openai",
    status: collection.status,
    checkedAt: collection.collectedAt,
    todayLiveAmountMinor: todayEstimate.amountMinor,
    currency: todayEstimate.currency,
    included: todayEstimate.amountMinor !== null,
    confidence: todayEstimate.amountMinor === null ? "none" : "medium",
    message: "OpenAI daily cost bucket is provisional until provider finalization.",
  };
}

async function collectSupabaseLiveToday(context: LiveTodayCollectionContext): Promise<LiveTodayProviderCollection> {
  const credential = await resolveProviderSecret(context, "supabase");
  const connector = createSupabaseUsageHealthConnector({
    client: createSupabaseManagementClient({
      accessToken: credential.secret,
    }),
  });
  const collection = await connector.collect({
    now: () => context.now,
  });

  return {
    providerKey: "supabase",
    status: collection.status,
    checkedAt: collection.collectedAt,
    todayLiveAmountMinor: null,
    currency: "USD",
    included: false,
    confidence: collection.status === "error" ? "none" : "low",
    message: "Supabase live checks expose usage and health, not reliable current-day cost.",
  };
}

async function collectCloudflareLiveToday(context: LiveTodayCollectionContext): Promise<LiveTodayProviderCollection> {
  const credential = await resolveProviderSecret(context, "cloudflare");
  const accountIds = readCloudflareAccountIds(context.env[CLOUDFLARE_ACCOUNT_IDS_ENV_KEY] ?? credential.metadata.accountIds);
  const connector = createCloudflareBillingUsageConnector({
    client: createCloudflareBillingUsageClient({
      apiToken: credential.secret,
      accountIds,
    }),
  });
  const collection = await connector.collect({
    now: () => context.now,
  });
  const estimate = summarizeAmount(collection.snapshots.costEstimates);

  return {
    providerKey: "cloudflare",
    status: collection.status,
    checkedAt: collection.collectedAt,
    todayLiveAmountMinor: estimate.amountMinor,
    currency: estimate.currency,
    included: false,
    confidence: collection.status === "error" ? "none" : "low",
    message: "Cloudflare exposes billing-period or month-to-date surfaces; exact current-day cost is excluded.",
  };
}

async function resolveProviderSecret(
  context: LiveTodayCollectionContext,
  providerKey: Exclude<ProviderKey, "aws">,
): Promise<{ secret: string; metadata: Readonly<Record<string, string>> }> {
  if (providerKey === "openai" && isConfigured(context.env.OPENAI_ADMIN_KEY)) {
    return {
      secret: context.env.OPENAI_ADMIN_KEY.trim(),
      metadata: {},
    };
  }

  if (providerKey === "supabase" && isConfigured(context.env.SUPABASE_ACCESS_TOKEN)) {
    return {
      secret: context.env.SUPABASE_ACCESS_TOKEN.trim(),
      metadata: {},
    };
  }

  if (providerKey === "cloudflare" && isConfigured(context.env.CLOUDFLARE_API_TOKEN)) {
    return {
      secret: context.env.CLOUDFLARE_API_TOKEN.trim(),
      metadata: {},
    };
  }

  const credential = await context.credentialStore.getCredential(providerKey, "read-only");

  if (credential === null) {
    throw new Error("Provider credential is not configured.");
  }

  return {
    secret: credential.secret,
    metadata: credential.metadata,
  };
}

function summarizeAmount(
  estimates: readonly {
    estimatedAmountMinor: number;
    currency: string;
  }[],
): { amountMinor: number | null; currency: string } {
  if (estimates.length === 0) {
    return {
      amountMinor: null,
      currency: "USD",
    };
  }

  const currencies = new Set(estimates.map((estimate) => estimate.currency));

  if (currencies.size !== 1) {
    return {
      amountMinor: null,
      currency: "MIXED",
    };
  }

  return {
    amountMinor: estimates.reduce((total, estimate) => total + estimate.estimatedAmountMinor, 0),
    currency: [...currencies][0] ?? "USD",
  };
}

function awsSdkOptionsFromEnv(env: Record<string, string | undefined>): { region?: string } {
  const region = env[AWS_REGION_ENV_KEY]?.trim();

  return region === undefined || region.length === 0 ? {} : { region };
}

function readCloudflareAccountIds(value: string | undefined): string[] {
  const accountIds = (value ?? "")
    .split(",")
    .map((accountId) => accountId.trim())
    .filter((accountId) => accountId.length > 0);

  if (accountIds.length === 0) {
    throw new Error("Cloudflare account IDs are required for live checks.");
  }

  return accountIds;
}

function dateKeyInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return [
    parts.find((part) => part.type === "year")?.value ?? "1970",
    parts.find((part) => part.type === "month")?.value ?? "01",
    parts.find((part) => part.type === "day")?.value ?? "01",
  ].join("-");
}

function expiresAt(now: Date, ttlSeconds: number): string {
  return new Date(now.getTime() + ttlSeconds * 1000).toISOString();
}

function isConfigured(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Live provider check failed.";
}
