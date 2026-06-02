import { runMigrations, type MigrationExecutor, type MigrationRunResult } from "./migrate.js";

export interface StackSpendDbClient {
  dbPath: string;
  migrate(): Promise<MigrationRunResult>;
}

export interface StackSpendDbClientOptions {
  dbPath: string;
  executor: MigrationExecutor;
}

export function createStackSpendDbClient(options: StackSpendDbClientOptions): StackSpendDbClient {
  const dbPath = options.dbPath.trim();

  if (dbPath.length === 0) {
    throw new Error("dbPath must not be blank.");
  }

  return {
    dbPath,
    migrate() {
      return runMigrations(options.executor);
    },
  };
}
