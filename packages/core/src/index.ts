export type ProviderKind = "mock" | "aws" | "openai" | "supabase" | "cloudflare";

export interface ProviderSnapshot {
  provider: ProviderKind;
  collectedAt: string;
  status: "ok" | "partial" | "error";
}
