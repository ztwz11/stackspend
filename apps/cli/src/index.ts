#!/usr/bin/env node

import { runCli } from "./cli.js";

const result = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
});

process.exitCode = result.exitCode;
