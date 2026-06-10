import { stat } from "node:fs/promises";
import {
  readLocalStore,
  type LocalAlertRecord,
  type LocalCostEstimateRecord,
  type LocalServiceHealthSnapshotRecord,
  type LocalStore,
} from "../../../packages/db/src/index.js";
import type { CliExecutionContext } from "./cli.js";
import { loadCliConfig, resolveDbPath } from "./commands/shared.js";

export interface SanitizedSummary {
  generatedAt: string;
  database: {
    path: string;
    available: boolean;
  };
  secretsReturned: false;
  providerCount: number;
  providers: SanitizedProviderSummary[];
  totals: {
    estimatedAmountMinorByCurrency: CurrencyTotal[];
    alertCount: number;
    health: "ok" | "degraded" | "down" | "unknown";
  };
}

export interface SanitizedProviderSummary {
  key: string;
  displayName: string;
  lastCollectedAt: string | null;
  usageSnapshotCount: number;
  billingSnapshotCount: number;
  healthSnapshotCount: number;
  costEstimateCount: number;
  alertCount: number;
  health: "ok" | "degraded" | "down" | "unknown";
  estimatedCost: {
    amountMinor: number;
    currency: string;
    confidence: "low" | "medium" | "high";
  } | null;
}

export interface NotificationDigest {
  generatedAt: string;
  secretsReturned: false;
  providerCount: number;
  estimatedAmountMinorByCurrency: CurrencyTotal[];
  alertCount: number;
  criticalAlertCount: number;
  health: "ok" | "degraded" | "down" | "unknown";
}

interface CurrencyTotal {
  currency: string;
  amountMinor: number;
}

export async function readSanitizedSummary(context: CliExecutionContext): Promise<SanitizedSummary> {
  const config = loadCliConfig(context.env);
  const dbPath = resolveDbPath(context.cwd, config.dbPath);
  const generatedAt = context.now().toISOString();

  if (!await pathExists(dbPath)) {
    return {
      generatedAt,
      database: {
        path: config.dbPath,
        available: false,
      },
      secretsReturned: false,
      providerCount: 0,
      providers: [],
      totals: {
        estimatedAmountMinorByCurrency: [],
        alertCount: 0,
        health: "unknown",
      },
    };
  }

  const store = await readLocalStore({ dbPath });
  const providers = store.providers.map((provider) => {
    const usageSnapshots = store.usageSnapshots.filter((snapshot) => snapshot.providerKey === provider.key);
    const billingSnapshots = store.billingSnapshots.filter((snapshot) => snapshot.providerKey === provider.key);
    const healthSnapshots = store.serviceHealthSnapshots.filter((snapshot) => snapshot.providerKey === provider.key);
    const costEstimates = store.costEstimates.filter((snapshot) => snapshot.providerKey === provider.key);
    const alerts = store.alerts.filter((alert) => alert.providerKey === provider.key);
    const latestCostEstimate = latestByCollectedAt(costEstimates);

    return {
      key: provider.key,
      displayName: provider.displayName,
      lastCollectedAt: latestTimestamp([
        ...usageSnapshots.map((snapshot) => snapshot.collectedAt),
        ...billingSnapshots.map((snapshot) => snapshot.collectedAt),
        ...healthSnapshots.map((snapshot) => snapshot.collectedAt),
        ...costEstimates.map((snapshot) => snapshot.collectedAt),
      ]),
      usageSnapshotCount: usageSnapshots.length,
      billingSnapshotCount: billingSnapshots.length,
      healthSnapshotCount: healthSnapshots.length,
      costEstimateCount: costEstimates.length,
      alertCount: alerts.length,
      health: summarizeHealth(healthSnapshots),
      estimatedCost: latestCostEstimate === undefined
        ? null
        : {
            amountMinor: latestCostEstimate.estimatedAmountMinor,
            currency: latestCostEstimate.currency,
            confidence: latestCostEstimate.confidence,
          },
    };
  });

  return {
    generatedAt,
    database: {
      path: config.dbPath,
      available: true,
    },
    secretsReturned: false,
    providerCount: providers.length,
    providers,
    totals: {
      estimatedAmountMinorByCurrency: summarizeCurrencyTotals(store.costEstimates),
      alertCount: store.alerts.length,
      health: summarizeProviderHealth(providers.map((provider) => provider.health)),
    },
  };
}

export function buildNotificationDigest(summary: SanitizedSummary, alerts: readonly LocalAlertRecord[] = []): NotificationDigest {
  return {
    generatedAt: summary.generatedAt,
    secretsReturned: false,
    providerCount: summary.providerCount,
    estimatedAmountMinorByCurrency: summary.totals.estimatedAmountMinorByCurrency,
    alertCount: summary.totals.alertCount,
    criticalAlertCount: alerts.filter((alert) => alert.severity === "critical").length,
    health: summary.totals.health,
  };
}

export async function readSanitizedNotificationDigest(context: CliExecutionContext): Promise<NotificationDigest> {
  const config = loadCliConfig(context.env);
  const dbPath = resolveDbPath(context.cwd, config.dbPath);
  const summary = await readSanitizedSummary(context);

  if (!summary.database.available) {
    return buildNotificationDigest(summary);
  }

  const store = await readLocalStore({ dbPath });

  return buildNotificationDigest(summary, store.alerts);
}

function summarizeCurrencyTotals(costEstimates: readonly LocalCostEstimateRecord[]): CurrencyTotal[] {
  const totals = new Map<string, number>();

  for (const estimate of costEstimates) {
    totals.set(estimate.currency, (totals.get(estimate.currency) ?? 0) + estimate.estimatedAmountMinor);
  }

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amountMinor]) => ({
      currency,
      amountMinor,
    }));
}

function summarizeHealth(snapshots: readonly LocalServiceHealthSnapshotRecord[]): "ok" | "degraded" | "down" | "unknown" {
  return summarizeProviderHealth(snapshots.map((snapshot) => snapshot.status));
}

function summarizeProviderHealth(statuses: readonly ("ok" | "degraded" | "down" | "unknown")[]): "ok" | "degraded" | "down" | "unknown" {
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

function latestByCollectedAt<T extends { collectedAt: string }>(items: readonly T[]): T | undefined {
  return [...items].sort((left, right) => right.collectedAt.localeCompare(left.collectedAt))[0];
}

function latestTimestamp(timestamps: readonly string[]): string | null {
  return [...timestamps].sort((left, right) => right.localeCompare(left))[0] ?? null;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
