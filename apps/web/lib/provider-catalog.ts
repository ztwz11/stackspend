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
  availableProviderKey?: ProviderKey;
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
  },
  {
    key: "azure",
    name: "Azure",
    category: "Cloud",
    status: "planned",
    authMethods: ["Azure CLI", "Service principal"],
    dataSurfaces: ["cost", "usage"],
    liveGranularity: "unavailable",
  },
  {
    key: "oracle",
    name: "Oracle Cloud",
    category: "Cloud",
    status: "planned",
    authMethods: ["OCI profile"],
    dataSurfaces: ["cost", "usage"],
    liveGranularity: "unavailable",
  },
  {
    key: "anthropic",
    name: "Anthropic Claude",
    category: "AI",
    status: "planned",
    authMethods: ["Admin API key"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
  },
  {
    key: "gemini",
    name: "Google Gemini / Vertex AI",
    category: "AI",
    status: "research",
    authMethods: ["Google auth"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
  },
  {
    key: "vercel",
    name: "Vercel",
    category: "Hosting",
    status: "planned",
    authMethods: ["API token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
  },
  {
    key: "github-actions",
    name: "GitHub Actions",
    category: "Hosting",
    status: "planned",
    authMethods: ["GitHub token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
  },
  {
    key: "railway",
    name: "Railway",
    category: "Hosting",
    status: "planned",
    authMethods: ["API token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
  },
  {
    key: "fly",
    name: "Fly.io",
    category: "Hosting",
    status: "planned",
    authMethods: ["API token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
  },
  {
    key: "netlify",
    name: "Netlify",
    category: "Hosting",
    status: "planned",
    authMethods: ["API token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
  },
  {
    key: "render",
    name: "Render",
    category: "Hosting",
    status: "planned",
    authMethods: ["API token"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
  },
  {
    key: "neon",
    name: "Neon",
    category: "Database",
    status: "planned",
    authMethods: ["API key"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
  },
  {
    key: "mongodb-atlas",
    name: "MongoDB Atlas",
    category: "Database",
    status: "planned",
    authMethods: ["API key"],
    dataSurfaces: ["usage", "cost", "health"],
    liveGranularity: "unavailable",
  },
  {
    key: "datadog",
    name: "Datadog",
    category: "Observability",
    status: "planned",
    authMethods: ["API key"],
    dataSurfaces: ["usage", "cost"],
    liveGranularity: "unavailable",
  },
  {
    key: "sentry",
    name: "Sentry",
    category: "Observability",
    status: "planned",
    authMethods: ["Auth token"],
    dataSurfaces: ["usage"],
    liveGranularity: "unavailable",
  },
];

export function findAvailableProvider(key: string): ProviderCatalogItem | undefined {
  return providerCatalog.find((provider) => provider.availableProviderKey === key);
}
