export const DEFAULT_DB_PATH = ".stackspend/stackspend.sqlite";

export const PROVIDER_ENV_KEYS = {
  aws: ["AWS_PROFILE"],
  openai: ["OPENAI_ADMIN_KEY"],
  supabase: ["SUPABASE_ACCESS_TOKEN"],
  cloudflare: ["CLOUDFLARE_API_TOKEN"],
} as const;

export type ConfiguredProvider = keyof typeof PROVIDER_ENV_KEYS;

export interface ProviderConfig {
  configured: boolean;
  requiredEnvKeys: readonly string[];
  configuredEnvKeys: readonly string[];
  missingEnvKeys: readonly string[];
}

export type ProviderConfigMap = {
  readonly [Provider in ConfiguredProvider]: ProviderConfig;
};

export interface SlackConfig {
  webhookConfigured: boolean;
  requiredEnvKey: "SLACK_WEBHOOK_URL";
}

export interface StackSpendConfig {
  dbPath: string;
  telemetryEnabled: false;
  providers: ProviderConfigMap;
  slack: SlackConfig;
}

export type StackSpendEnv = Record<string, string | undefined>;
