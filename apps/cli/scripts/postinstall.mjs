import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "..");
const compiledPostinstall = resolve(packageRoot, "dist", "apps", "cli", "src", "postinstall.js");

if (existsSync(compiledPostinstall)) {
  await import(pathToFileURL(compiledPostinstall).href);
}
