import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const webRoot = resolve(repoRoot, "apps", "web");
const nextBin = resolve(webRoot, "node_modules", "next", "dist", "bin", "next");
const tscBin = resolve(repoRoot, "node_modules", "typescript", "bin", "tsc");
const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
};

run(process.execPath, [nextBin, "typegen"]);
run(process.execPath, [tscBin, "-p", "tsconfig.json", "--noEmit"]);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: webRoot,
    env,
    stdio: "inherit",
  });

  if (result.error !== undefined) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.signal !== null) {
    console.error(`${command} exited from signal ${result.signal}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
