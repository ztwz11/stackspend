#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "..");
const cliEntry = resolve(packageRoot, "dist", "apps", "cli", "src", "index.js");

if (isTruthy(process.env.MONEYSIREN_SKIP_APP_POSTINSTALL)) {
  console.log("MoneySiren app asset installation skipped by MONEYSIREN_SKIP_APP_POSTINSTALL.");
  process.exit(0);
}

if (!existsSync(cliEntry)) {
  console.warn("MoneySiren app package is missing its bundled CLI entrypoint.");
  console.warn("Run `msiren install --all` after installation if the command is available.");
  process.exit(0);
}

if (!shouldInstallReleaseAssets()) {
  console.log("MoneySiren app package installed.");
  console.log("Run `msiren install --all` to download the local web dashboard and HUD artifacts.");
  process.exit(0);
}

console.log("MoneySiren app package installed.");
console.log("Installing local web dashboard and HUD artifacts...");

const result = spawnSync(process.execPath, [cliEntry, "install", "--all"], {
  cwd: process.env.INIT_CWD || process.cwd(),
  encoding: "utf8",
  env: {
    ...process.env,
    MONEYSIREN_APP_POSTINSTALL: "1",
  },
  stdio: "inherit",
  windowsHide: true,
});

if (result.error !== undefined) {
  console.error(`MoneySiren app asset installation failed: ${result.error.message}`);
  console.error("Retry with `msiren install --all` after npm finishes.");
  process.exit(1);
}

if (result.status !== 0) {
  console.error("MoneySiren app asset installation failed.");
  console.error("Retry with `msiren install --all` after npm finishes.");
  process.exit(result.status ?? 1);
}

function shouldInstallReleaseAssets() {
  return isTruthy(process.env.MONEYSIREN_APP_INSTALL_ALL) ||
    process.env.npm_config_global === "true" ||
    process.env.npm_config_location === "global";
}

function isTruthy(value) {
  if (value === undefined) {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  return normalized.length > 0 && normalized !== "0" && normalized !== "false" && normalized !== "no";
}
