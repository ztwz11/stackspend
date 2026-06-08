export type ProviderKey = "aws" | "openai" | "supabase" | "cloudflare";
export type ProviderCatalogStatus = "available" | "planned" | "research";
export type ProviderCategory = "Cloud" | "AI" | "Database" | "Hosting" | "Observability";
export type LiveGranularity =
  | "exact_today"
  | "daily_bucket"
  | "month_to_date"
  | "current_period"
  | "usage_only"
  | "unavailable";

export interface ProviderCatalogItem {
  key: string;
  name: string;
  category: ProviderCategory;
  status: ProviderCatalogStatus;
  authMethods: readonly string[];
  dataSurfaces: readonly string[];
  liveGranularity: LiveGranularity;
  setupLinks: readonly ProviderSetupLink[];
  availableProviderKey?: ProviderKey;
}

export interface ProviderSetupLink {
  label: string;
  href: string;
  description: string;
  valueHints: readonly string[];
}

export const AVAILABLE_PROVIDER_KEYS = ["aws", "openai", "supabase", "cloudflare"] as const;

export const providerCatalog: readonly ProviderCatalogItem[] = [
  {
    key: "aws",
    name: "AWS",
    category: "Cloud",
    status: "available",
    authMethods: ["AWS profile", "IAM Identity Center"],
    dataSurfaces: ["cost", "usage", "forecast", "health"],
    liveGranularity: "current_period",
    setupLinks: [
      {
        label: "AWS CLI profiles",
        href: "https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html",
        description: "Find or create the AWS_PROFILE used by the local SDK credential chain.",
        valueHints: ["AWS_PROFILE"],
      },
      {
        label: "Cost Explorer API access",
        href: "https://docs.aws.amazon.com/cost-management/latest/userguide/ce-api.html",
        description: "Confirm the read-only Cost Explorer permissions required for cost and usage queries.",
        valueHints: ["ce:GetCostAndUsage", "ce:GetCostForecast"],
      },
    ],
    availableProviderKey: "aws",
  },
  {
    key: "openai",
    name: "OpenAI",
    category: "AI",
    status: "available",
    authMethods: ["Admin API key"],
    dataSurfaces: ["cost", "usage", "forecast"],
    liveGranularity: "daily_bucket",
    setupLinks: [
      {
        label: "Admin API key",
        href: "https://platform.openai.com/docs/api-reference/administration",
        description: "Create an organization Admin API key for read-only usage and costs endpoints.",
        valueHints: ["OPENAI_ADMIN_KEY"],
      },
      {
        label: "Usage and costs API",
        href: "https://platform.openai.com/docs/api-reference/usage/cost",
        description: "Verify the Usage API and Costs endpoint surfaces used for current LLM usage.",
        valueHints: ["organization usage", "organization costs"],
      },
    ],
    availableProviderKey: "openai",
  },
  {
    key: "supabase",
    name: "Supabase",
    category: "Database",
    status: "available",
    authMethods: ["OAuth2", "PAT"],
    dataSurfaces: ["usage", "health"],
    liveGranularity: "usage_only",
    setupLinks: [
      {
        label: "Management API tokens",
        href: "https://supabase.com/docs/reference/api/getting-started",
        description: "Create or review a Supabase access token for Management API reads.",
        valueHints: ["SUPABASE_ACCESS_TOKEN"],
      },
      {
        label: "OAuth scopes",
        href: "https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration/oauth-scopes",
        description: "Confirm OAuth scopes before using the local OAuth broker flow.",
        valueHints: ["projects:read", "analytics_usage_read"],
      },
    ],
    availableProviderKey: "supabase",
  },
  {
    key: "cloudflare",
    name: "Cloudflare",
    category: "Cloud",
    status: "available",
    authMethods: ["API token"],
    dataSurfaces: ["cost", "usage", "health"],
    liveGranularity: "month_to_date",
    setupLinks: [
      {
        label: "Billing API permissions",
        href: "https://developers.cloudflare.com/billing/understand/billing-permissions/",
        description: "Create an API token with Account Billing Read access.",
        valueHints: ["CLOUDFLARE_API_TOKEN"],
      },
      {
        label: "Billing usage API",
        href: "https://developers.cloudflare.com/api/resources/organizations/subresources/billing",
        description: "Confirm the billing usage API surface and account or organization identifiers.",
        valueHints: ["CLOUDFLARE_ACCOUNT_IDS"],
      },
    ],
    availableProviderKey: "cloudflare",
  },
  {
    key: "gcp",
    name: "GCP",
    category: "Cloud",
    status: "planned",
    authMethods: ["Application Default Credentials", "Service account"],
    dataSurfaces: ["cost", "usage", "forecast"],
    liveGranularity: "unavailable",
    setupLinks: [],
  },
  {
    key: "azure",
    name: "Azure",
    category: "Cloud",
    status: "planned",
    authMethods: ["Azure CLI", "Service principal"],
    dataSurfaces: ["cost", "usage"],
    liveGranularity: "unavailable",
    setupLinks: [],
  },
  {
    key: "oracle",
    name: "Oracle Cloud",
    category: "Cloud",
    status: "planned",
    authMethods: ["OCI profile"],
    dataSurfaces: ["cost", "usage"],
    liveGranularity: "unavailable",
    setupLinks: [],
  },
  {
    key: "anthropic",
    name: "Anthropic Claude",
    category: "AI",
    status: "planned",
    authMethods: ["Admin API key"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    setupLinks: [
      {
        label: "Anthropic usage report",
        href: "https://platform.claude.com/docs/en/api/admin/usage_report/retrieve_messages",
        description: "Planned integration target for Claude message usage reporting.",
        valueHints: ["ANTHROPIC_ADMIN_KEY"],
      },
    ],
  },
  {
    key: "gemini",
    name: "Google Gemini / Vertex AI",
    category: "AI",
    status: "research",
    authMethods: ["Google auth"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    setupLinks: [
      {
        label: "Gemini billing",
        href: "https://ai.google.dev/gemini-api/docs/billing",
        description: "Research target for Gemini usage and Cloud Billing visibility.",
        valueHints: ["Google Cloud project", "API key"],
      },
    ],
  },
  {
    key: "vercel",
    name: "Vercel",
    category: "Hosting",
    status: "planned",
    authMethods: ["API token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    setupLinks: [],
  },
  {
    key: "github-actions",
    name: "GitHub Actions",
    category: "Hosting",
    status: "planned",
    authMethods: ["GitHub token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    setupLinks: [],
  },
  {
    key: "railway",
    name: "Railway",
    category: "Hosting",
    status: "planned",
    authMethods: ["API token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    setupLinks: [],
  },
  {
    key: "fly",
    name: "Fly.io",
    category: "Hosting",
    status: "planned",
    authMethods: ["API token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    setupLinks: [],
  },
  {
    key: "netlify",
    name: "Netlify",
    category: "Hosting",
    status: "planned",
    authMethods: ["API token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    setupLinks: [],
  },
  {
    key: "render",
    name: "Render",
    category: "Hosting",
    status: "planned",
    authMethods: ["API token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    setupLinks: [],
  },
  {
    key: "neon",
    name: "Neon",
    category: "Database",
    status: "planned",
    authMethods: ["API key"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    setupLinks: [],
  },
  {
    key: "mongodb-atlas",
    name: "MongoDB Atlas",
    category: "Database",
    status: "planned",
    authMethods: ["API key"],
    dataSurfaces: ["usage", "cost", "health"],
    liveGranularity: "unavailable",
    setupLinks: [],
  },
  {
    key: "datadog",
    name: "Datadog",
    category: "Observability",
    status: "planned",
    authMethods: ["API key"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
    setupLinks: [],
  },
  {
    key: "sentry",
    name: "Sentry",
    category: "Observability",
    status: "planned",
    authMethods: ["Auth token"],
    dataSurfaces: ["usage"],
    liveGranularity: "unavailable",
    setupLinks: [],
  },
];

export function findAvailableProvider(key: string): ProviderCatalogItem | undefined {
  return providerCatalog.find((provider) => provider.availableProviderKey === key);
}
