import { renderKoreanDailyReport } from "./korean.js";

export { renderKoreanDailyReport } from "./korean.js";

export type DailyReportLanguage = "ko";

export interface DailyReportInput {
  reportDate: string;
  generatedAt: string;
  providerSummaries: readonly DailyProviderSummary[];
  reportRunStatus: "rendered" | "sent" | "error";
}

export interface DailyProviderSummary {
  provider: string;
  displayName: string;
  syncStatus: "ok" | "partial" | "error";
  usageSnapshotCount: number;
  billingSnapshotCount: number;
  healthStatus: "ok" | "degraded" | "down" | "unknown";
  estimatedAmountMinor: number;
  currency: string;
  alertCount: number;
}

export interface RenderDailyReportOptions {
  lang: DailyReportLanguage;
}

export function renderDailyReport(input: DailyReportInput, options: RenderDailyReportOptions): string {
  if (options.lang === "ko") {
    return renderKoreanDailyReport(input);
  }

  throw new Error(`Unsupported daily report language: ${String(options.lang)}`);
}
