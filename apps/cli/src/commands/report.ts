import {
  initializeLocalStore,
  readLocalStore,
  recordLocalReportRun,
  type LocalStore,
} from "../../../../packages/db/src/index.js";
import { renderDailyReport, type DailyProviderSummary, type DailyReportInput } from "../../../../packages/report/src/index.js";
import type { CliExecutionContext } from "../cli.js";
import { loadCliConfig, readFlag, resolveDbPath } from "./shared.js";

export async function runReportCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  const [reportKind, ...rest] = args;
  const langFlag = readFlag(rest, "--lang");

  if (reportKind !== "daily" || langFlag.remainingArgs.length > 0 || langFlag.value !== "ko") {
    context.stderr("Usage: stackspend report daily --lang ko");
    return 1;
  }

  const config = loadCliConfig(context.env);
  const dbPath = resolveDbPath(context.cwd, config.dbPath);
  await initializeLocalStore({ dbPath });

  const now = context.now();
  const generatedAt = now.toISOString();
  const reportDate = generatedAt.slice(0, 10);
  const store = await readLocalStore({ dbPath });

  const reportInput: DailyReportInput = {
    reportDate,
    generatedAt,
    providerSummaries: buildProviderSummaries(store),
    reportRunStatus: "rendered",
  };

  await recordLocalReportRun({
    dbPath,
    createdAt: generatedAt,
    reportDate,
    language: "ko",
    deliveryTarget: "stdout",
    status: "rendered",
  });

  context.stdout(renderDailyReport(reportInput, { lang: "ko" }));
  context.stdout("Report run recorded: stdout");
  return 0;
}

function buildProviderSummaries(store: LocalStore): DailyProviderSummary[] {
  return store.providers.map((provider) => {
    const usageSnapshots = store.usageSnapshots.filter((snapshot) => snapshot.providerKey === provider.key);
    const billingSnapshots = store.billingSnapshots.filter((snapshot) => snapshot.providerKey === provider.key);
    const serviceHealthSnapshots = store.serviceHealthSnapshots.filter(
      (snapshot) => snapshot.providerKey === provider.key,
    );
    const costEstimates = store.costEstimates.filter((snapshot) => snapshot.providerKey === provider.key);
    const alerts = store.alerts.filter((alert) => alert.providerKey === provider.key);
    const currency = costEstimates[0]?.currency ?? billingSnapshots[0]?.currency ?? "USD";

    return {
      provider: provider.key,
      displayName: provider.displayName,
      syncStatus: summarizeSyncStatus([
        usageSnapshots.length,
        billingSnapshots.length,
        serviceHealthSnapshots.length,
        costEstimates.length,
      ]),
      usageSnapshotCount: usageSnapshots.length,
      billingSnapshotCount: billingSnapshots.length,
      healthStatus: summarizeHealth(serviceHealthSnapshots.map((snapshot) => snapshot.status)),
      estimatedAmountMinor: costEstimates.reduce((total, snapshot) => total + snapshot.estimatedAmountMinor, 0),
      currency,
      alertCount: alerts.length,
    };
  });
}

function summarizeSyncStatus(snapshotCounts: readonly number[]): DailyProviderSummary["syncStatus"] {
  return snapshotCounts.some((count) => count > 0) ? "ok" : "error";
}

function summarizeHealth(statuses: readonly DailyProviderSummary["healthStatus"][]): DailyProviderSummary["healthStatus"] {
  if (statuses.includes("down")) {
    return "down";
  }

  if (statuses.includes("degraded")) {
    return "degraded";
  }

  if (statuses.includes("unknown") || statuses.length === 0) {
    return "unknown";
  }

  return "ok";
}
