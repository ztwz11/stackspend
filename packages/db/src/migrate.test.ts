import { describe, expect, it } from "vitest";
import { INITIAL_SCHEMA_SQL, REQUIRED_TABLES } from "./schema.js";
import { getPendingMigrations, runMigrations } from "./migrate.js";

describe("initial SQLite schema", () => {
  it("declares the required v0.1 tables without raw provider payload storage", () => {
    for (const tableName of REQUIRED_TABLES) {
      expect(INITIAL_SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${tableName}`);
    }

    expect(INITIAL_SCHEMA_SQL).not.toMatch(/\braw_?payload\b/i);
    expect(INITIAL_SCHEMA_SQL).not.toMatch(/\braw_?response\b/i);
    expect(INITIAL_SCHEMA_SQL).not.toMatch(/\bbilling_profile\b/i);
  });
});

describe("migration runner", () => {
  it("returns only unapplied migrations in order", () => {
    expect(getPendingMigrations([]).map((migration) => migration.id)).toEqual(["0001_init"]);
    expect(getPendingMigrations(["0001_init"]).map((migration) => migration.id)).toEqual([]);
  });

  it("runs pending migrations once and skips already-applied migrations", async () => {
    const executedSql: string[] = [];
    const recordedIds: string[] = [];

    await runMigrations({
      async getAppliedMigrationIds() {
        return recordedIds;
      },
      async execute(sql) {
        executedSql.push(sql);
      },
      async recordMigration(id) {
        recordedIds.push(id);
      },
    });

    expect(executedSql).toHaveLength(1);
    expect(executedSql[0]).toContain("CREATE TABLE IF NOT EXISTS providers");
    expect(recordedIds).toEqual(["0001_init"]);

    executedSql.length = 0;

    await runMigrations({
      async getAppliedMigrationIds() {
        return recordedIds;
      },
      async execute(sql) {
        executedSql.push(sql);
      },
      async recordMigration(id) {
        recordedIds.push(id);
      },
    });

    expect(executedSql).toEqual([]);
    expect(recordedIds).toEqual(["0001_init"]);
  });
});
