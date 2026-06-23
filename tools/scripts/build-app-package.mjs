import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const cliRoot = resolve(repoRoot, "apps", "cli");
const appRoot = resolve(repoRoot, "apps", "app");
const appDist = resolve(appRoot, "dist");

run("node", ["tools/scripts/build-cli.mjs"], {
  cwd: repoRoot,
});

await rm(appDist, {
  force: true,
  recursive: true,
});
await mkdir(appDist, {
  recursive: true,
});
await cp(resolve(cliRoot, "dist", "apps"), resolve(appDist, "apps"), {
  recursive: true,
});
await cp(resolve(cliRoot, "dist", "packages"), resolve(appDist, "packages"), {
  recursive: true,
});

function run(command, args, options) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed.`);
  }
}
