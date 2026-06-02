#!/usr/bin/env node

const VERSION = "0.1.0-alpha.0";

const HELP = `StackSpend ${VERSION}

Local-first cloud/SaaS usage, status, and expected billing dashboard.

Usage:
  stackspend --help
  stackspend --version

Planned v0.1 commands:
  init       Initialize local StackSpend config and storage
  doctor     Check local configuration and provider readiness
  sync       Collect read-only provider snapshots
  report     Render daily reports
  serve      Start the local dashboard
`;

function main(args: string[]): void {
  const [command] = args;

  if (!command || command === "--help" || command === "-h" || command === "help") {
    console.log(HELP);
    return;
  }

  if (command === "--version" || command === "-v" || command === "version") {
    console.log(VERSION);
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.error("Run `stackspend --help` for usage.");
  process.exitCode = 1;
}

main(process.argv.slice(2));
