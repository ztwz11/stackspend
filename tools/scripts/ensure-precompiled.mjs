import { readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const runPnpmScript = resolve(scriptDir, "run-pnpm.mjs");
const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  console.log("Usage: node tools/scripts/ensure-precompiled.mjs [--web]");
  process.exit(0);
}

const ensureWeb = args.size === 0 || args.has("--web");

if (!ensureWeb) {
  console.error("Usage: node tools/scripts/ensure-precompiled.mjs [--web]");
  process.exit(1);
}

if (ensureWeb) {
  ensureWebBuild();
}

function ensureWebBuild() {
  const buildIdPath = resolve(repoRoot, "apps/web/.next/BUILD_ID");
  const buildMtime = fileMtimeMs(buildIdPath);

  if (buildMtime === null) {
    runWebBuild("web build output is missing");
    return;
  }

  const newestSourceMtime = newestMtimeMs([
    resolve(repoRoot, "apps/web/app"),
    resolve(repoRoot, "apps/web/components"),
    resolve(repoRoot, "apps/web/lib"),
    resolve(repoRoot, "apps/web/package.json"),
    resolve(repoRoot, "packages/config/src"),
    resolve(repoRoot, "packages/connectors"),
    resolve(repoRoot, "packages/core/src"),
    resolve(repoRoot, "packages/credentials/src"),
    resolve(repoRoot, "packages/db/src"),
    resolve(repoRoot, "packages/local-api/src"),
    resolve(repoRoot, "packages/report/src"),
    resolve(repoRoot, "packages/runtime/src"),
    resolve(repoRoot, "packages/security/src"),
    resolve(repoRoot, "packages/view-model/src"),
  ]);

  if (newestSourceMtime > buildMtime) {
    runWebBuild("web source changed after the last build");
    return;
  }

  console.log("[precompile] web build is up to date");
}

function runWebBuild(reason) {
  console.log(`[precompile] ${reason}; running web build`);
  const result = spawnSync(process.execPath, [runPnpmScript, "--filter", "@moneysiren/web", "build"], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error !== undefined) {
    console.error(`[precompile] ${result.error.message}`);
    process.exit(1);
  }

  if (result.signal !== null) {
    console.error(`[precompile] web build exited from signal ${result.signal}`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

function newestMtimeMs(paths) {
  let newest = 0;

  for (const path of paths) {
    newest = Math.max(newest, pathNewestMtimeMs(path));
  }

  return newest;
}

function pathNewestMtimeMs(path) {
  let entryStat;

  try {
    entryStat = statSync(path);
  } catch {
    return 0;
  }

  if (!entryStat.isDirectory()) {
    return entryStat.mtimeMs;
  }

  let newest = entryStat.mtimeMs;

  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (shouldSkipEntry(entry.name)) {
      continue;
    }

    newest = Math.max(newest, pathNewestMtimeMs(resolve(path, entry.name)));
  }

  return newest;
}

function fileMtimeMs(path) {
  try {
    const entryStat = statSync(path);

    return entryStat.isFile() ? entryStat.mtimeMs : null;
  } catch {
    return null;
  }
}

function shouldSkipEntry(name) {
  return name === ".git" ||
    name === ".next" ||
    name === ".moneysiren" ||
    name === "dist" ||
    name === "node_modules" ||
    name === "target";
}
