#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync, readlinkSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

if (isTruthy(process.env.MONEYSIREN_SKIP_APP_PREINSTALL)) {
  process.exit(0);
}

if (!isGlobalInstall()) {
  process.exit(0);
}

const prefix = process.env.npm_config_prefix;

if (!prefix) {
  console.warn("MoneySiren app preinstall skipped: npm global prefix was not provided.");
  process.exit(0);
}

const binDir = process.platform === "win32" ? prefix : join(prefix, "bin");
const shimNames = process.platform === "win32"
  ? ["moneysiren", "moneysiren.cmd", "moneysiren.ps1", "msiren", "msiren.cmd", "msiren.ps1"]
  : ["moneysiren", "msiren"];
const removed = [];

for (const shimName of shimNames) {
  const shimPath = resolve(binDir, shimName);

  if (!isInside(resolve(binDir), shimPath) || !existsSync(shimPath)) {
    continue;
  }

  if (!isMoneySirenShim(shimPath)) {
    continue;
  }

  try {
    rmSync(shimPath, {
      force: true,
    });
    removed.push(shimName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`MoneySiren app preinstall could not remove stale global command ${shimName}: ${message}`);
  }
}

if (removed.length > 0) {
  console.log(`MoneySiren app preinstall removed stale global command shim(s): ${removed.join(", ")}`);
}

function isGlobalInstall() {
  return process.env.npm_config_global === "true" ||
    process.env.npm_config_location === "global" ||
    isTruthy(process.env.MONEYSIREN_APP_GLOBAL_PREINSTALL);
}

function isMoneySirenShim(filePath) {
  try {
    const stat = lstatSync(filePath);
    const source = stat.isSymbolicLink()
      ? readlinkSync(filePath)
      : stat.isFile()
        ? readFileSync(filePath, "utf8")
        : "";

    return /@moneysiren[\\/]app|@moneysiren[\\/]cli|moneysiren-app|moneysiren-cli/i.test(source);
  } catch {
    return false;
  }
}

function isInside(parent, child) {
  const relative = child.slice(parent.length);
  return child === parent || (child.startsWith(parent) && /^[/\\]/.test(relative));
}

function isTruthy(value) {
  if (value === undefined) {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  return normalized.length > 0 && normalized !== "0" && normalized !== "false" && normalized !== "no";
}
