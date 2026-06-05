import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ALLOWED_WORKSPACE_SCRIPTS = new Set(["build", "test", "typecheck", "lint"]);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const args = process.argv.slice(2);
const env = {
  ...process.env,
};

if (env.COREPACK_HOME === undefined || env.COREPACK_HOME.trim().length === 0) {
  env.COREPACK_HOME = resolve(repoRoot, ".stackspend", "corepack");
}

let pnpmArgs = args;

if (args[0] === "--workspace-script") {
  const workspaceScript = args[1];

  if (workspaceScript === undefined || !ALLOWED_WORKSPACE_SCRIPTS.has(workspaceScript)) {
    console.error("Usage: node tools/scripts/run-pnpm.mjs --workspace-script <build|test|typecheck|lint>");
    process.exit(1);
  }

  pnpmArgs = ["-r", workspaceScript];

  if (workspaceScript === "test") {
    const tmpDir = resolve(repoRoot, ".stackspend", "tmp");
    mkdirSync(tmpDir, { recursive: true });
    env.TMPDIR = tmpDir;
  }
}

const result = runCorepackPnpm(pnpmArgs, env);

if (result.error !== undefined) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.signal !== null) {
  console.error(`corepack pnpm exited from signal ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 1);

function runCorepackPnpm(pnpmArgs, env) {
  if (process.platform === "win32") {
    const commandLine = ["corepack", "pnpm", ...pnpmArgs].map(quoteWindowsArg).join(" ");

    return spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", commandLine], {
      cwd: repoRoot,
      env,
      stdio: "inherit",
    });
  }

  return spawnSync("corepack", ["pnpm", ...pnpmArgs], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });
}

function quoteWindowsArg(value) {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '\\"')}"`;
}
