import { chmodSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const cliRoot = resolve(repoRoot, "apps", "cli");
const tscBin = resolve(repoRoot, "node_modules", "typescript", "bin", "tsc");
const cliDist = resolve(cliRoot, "dist");
const cliBin = resolve(cliRoot, "dist", "apps", "cli", "src", "index.js");

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
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (process.platform !== "win32") {
  chmodSync(cliBin, 0o755);
}
