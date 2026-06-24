import { chmodSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { acquireCliBuildLock } from "./lib/cli-build-lock.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const cliRoot = resolve(repoRoot, "apps", "cli");
const tscBin = resolve(repoRoot, "node_modules", "typescript", "bin", "tsc");
const cliDist = resolve(cliRoot, "dist");
const cliBin = resolve(cliRoot, "dist", "apps", "cli", "src", "index.js");
const lock = process.env.MONEYSIREN_CLI_BUILD_LOCK_HELD === "1" ? null : acquireCliBuildLock();
let exitCode = 0;

try {
  rmSync(cliDist, {
    force: true,
    recursive: true,
  });

  const result = spawnSync(process.execPath, [tscBin, "-p", "tsconfig.build.json"], {
    cwd: cliRoot,
    stdio: "inherit",
  });

  if (result.error !== undefined) {
    console.error(result.error.message);
    exitCode = 1;
  } else if (result.status !== 0) {
    exitCode = result.status ?? 1;
  } else if (process.platform !== "win32") {
    chmodSync(cliBin, 0o755);
  }
} finally {
  lock?.release();
}

process.exitCode = exitCode;
