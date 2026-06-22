import type { CliExecutionContext } from "../cli.js";
import {
  createFallbackDesktopRuntimeAdapter,
  type CliDesktopRuntimeAdapter,
  type DesktopRuntimeResult,
  type DesktopShellResult,
} from "../desktop-runtime.js";
import {
  createFallbackLocalRuntimeAdapter,
  type CliLocalRuntimeAdapter,
  type LocalRuntime,
  type StartRuntimeResult,
} from "../runtime-adapter.js";

const SERVE_USAGE = "Usage: moneysiren serve [--port <port>]";
const START_USAGE = "Usage: msiren start [--port <port>] [--open|--no-open] [--hud]";
const HUD_USAGE = "Usage: msiren hud [--port <port>]";
const OPEN_USAGE = "Usage: moneysiren open";
const DESKTOP_USAGE = "Usage: moneysiren desktop status";

interface ParsedServeArgs {
  port?: number;
}

interface ParsedStartArgs {
  launchHud: boolean;
  openBrowser: boolean;
  port?: number;
}

interface ParsedHudArgs {
  port?: number;
}

export async function runServeCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(SERVE_USAGE);
    return 0;
  }

  const parsed = parseServeArgs(args);

  if (parsed === undefined) {
    context.stderr(SERVE_USAGE);
    return 1;
  }

  const result = await runtimeAdapter(context).startRuntime({
    headless: false,
    ...(parsed.port === undefined ? {} : { port: parsed.port }),
  });

  return writeStartRuntimeResult(context, result, "MoneySiren local runtime");
}

export async function runStartCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(START_USAGE);
    return 0;
  }

  const parsed = parseStartArgs(args);

  if (parsed === undefined) {
    context.stderr(START_USAGE);
    return 1;
  }

  const adapter = desktopRuntimeAdapter(context);
  const web = await adapter.startWebRuntime({
    openBrowser: parsed.openBrowser,
    ...(parsed.port === undefined ? {} : { port: parsed.port }),
  });
  const webExitCode = writeDesktopRuntimeResult(context, web, "MoneySiren dashboard runtime");

  if (webExitCode !== 0) {
    return webExitCode;
  }

  if (web.status !== "unavailable" && parsed.openBrowser) {
    await context.openUrl(web.dashboardUrl);
    context.stdout(`Dashboard URL: ${web.dashboardUrl}`);
  }

  if (!parsed.launchHud) {
    context.stdout("HUD: run `msiren hud` to open the floating desktop widget.");
    return 0;
  }

  const hud = await adapter.startHud({
    ...(parsed.port === undefined ? {} : { port: parsed.port }),
  });

  return writeDesktopShellResult(context, hud, "MoneySiren HUD");
}

export async function runHudCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(HUD_USAGE);
    return 0;
  }

  const parsed = parseHudArgs(args);

  if (parsed === undefined) {
    context.stderr(HUD_USAGE);
    return 1;
  }

  const adapter = desktopRuntimeAdapter(context);
  const web = await adapter.startWebRuntime({
    openBrowser: false,
    ...(parsed.port === undefined ? {} : { port: parsed.port }),
  });
  const webExitCode = writeDesktopRuntimeResult(context, web, "MoneySiren dashboard runtime");

  if (webExitCode !== 0) {
    return webExitCode;
  }

  const hud = await adapter.startHud({
    ...(parsed.port === undefined ? {} : { port: parsed.port }),
  });

  return writeDesktopShellResult(context, hud, "MoneySiren HUD");
}

export async function runOpenCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(OPEN_USAGE);
    return 0;
  }

  if (args.length > 0) {
    context.stderr(OPEN_USAGE);
    return 1;
  }

  const adapter = runtimeAdapter(context);
  const runtime = await findHealthyRuntime(adapter);
  const startResult = runtime === null
    ? await adapter.startRuntime({
        headless: true,
      })
    : {
        status: "running" as const,
        runtime,
      };

  if (startResult.status === "unavailable") {
    return writeStartRuntimeResult(context, startResult, "MoneySiren open");
  }

  context.stdout("MoneySiren local API runtime ready");
  context.stdout(`Runtime: ${startResult.status}`);
  context.stdout(`Local API URL: ${startResult.runtime.baseUrl}`);
  context.stdout("Dashboard UI: not opened because this runtime URL is a JSON API.");
  context.stdout("Start the web dashboard:");
  context.stdout("  pnpm --filter @moneysiren/web dev");
  context.stdout("Then open: http://localhost:3000");
  return 0;
}

export async function runDesktopCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  const [subcommand, ...rest] = args;

  if (subcommand === "--help" || subcommand === "-h" || subcommand === "help") {
    context.stdout(DESKTOP_USAGE);
    return 0;
  }

  if (subcommand !== "status" || rest.length > 0) {
    context.stderr(DESKTOP_USAGE);
    return 1;
  }

  const adapter = runtimeAdapter(context);
  const runtime = await adapter.findRuntime();

  context.stdout("MoneySiren desktop status");

  if (runtime === null) {
    context.stdout("Runtime: not running");
    context.stdout("Runtime lock: not found");
    context.stdout("Desktop shell: not detected by CLI");
    context.stdout("Next step: run `moneysiren serve` or start the native tray app.");
    return 0;
  }

  const healthy = await adapter.assertRuntimeHealthy(runtime);

  context.stdout(`Runtime: ${healthy ? "healthy" : "unhealthy"}`);
  context.stdout(`Base URL: ${runtime.baseUrl}`);
  context.stdout(`PID: ${runtime.pid}`);
  context.stdout(`Started at: ${runtime.startedAt}`);
  context.stdout(`Version: ${runtime.version}`);
  context.stdout("Desktop shell: not detected by CLI");
  return healthy ? 0 : 1;
}

function runtimeAdapter(context: CliExecutionContext): CliLocalRuntimeAdapter {
  return context.localRuntime ?? createFallbackLocalRuntimeAdapter(context);
}

function desktopRuntimeAdapter(context: CliExecutionContext): CliDesktopRuntimeAdapter {
  return context.desktopRuntime ?? createFallbackDesktopRuntimeAdapter(context);
}

async function findHealthyRuntime(adapter: CliLocalRuntimeAdapter): Promise<LocalRuntime | null> {
  const runtime = await adapter.findRuntime();

  if (runtime === null) {
    return null;
  }

  return await adapter.assertRuntimeHealthy(runtime) ? runtime : null;
}

function writeStartRuntimeResult(
  context: CliExecutionContext,
  result: StartRuntimeResult,
  heading: string,
): number {
  if (result.status !== "unavailable") {
    context.stdout(heading);
    context.stdout(`Runtime: ${result.status}`);
    context.stdout(`Base URL: ${result.runtime.baseUrl}`);
    context.stdout(`PID: ${result.runtime.pid}`);
    return 0;
  }

  context.stderr(`${heading}: unavailable`);
  context.stderr(result.reason);

  for (const line of result.guidance) {
    context.stderr(line);
  }

  return 1;
}

function writeDesktopRuntimeResult(
  context: CliExecutionContext,
  result: DesktopRuntimeResult,
  heading: string,
): number {
  if (result.status !== "unavailable") {
    context.stdout(heading);
    context.stdout(`Runtime: ${result.status}`);
    context.stdout(`Dashboard URL: ${result.dashboardUrl}`);

    if (result.pid !== undefined) {
      context.stdout(`PID: ${result.pid}`);
    }

    for (const note of result.notes) {
      context.stdout(`Note: ${note}`);
    }

    return 0;
  }

  context.stderr(`${heading}: unavailable`);
  context.stderr(result.reason);

  for (const line of result.guidance) {
    context.stderr(line);
  }

  return 1;
}

function writeDesktopShellResult(
  context: CliExecutionContext,
  result: DesktopShellResult,
  heading: string,
): number {
  if (result.status !== "unavailable") {
    context.stdout(heading);
    context.stdout(`Desktop shell: ${result.status}`);

    if (result.pid !== undefined) {
      context.stdout(`PID: ${result.pid}`);
    }

    for (const note of result.notes) {
      context.stdout(`Note: ${note}`);
    }

    return 0;
  }

  context.stderr(`${heading}: unavailable`);
  context.stderr(result.reason);

  for (const line of result.guidance) {
    context.stderr(line);
  }

  return 1;
}

function parseServeArgs(args: readonly string[]): ParsedServeArgs | undefined {
  let port: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--port") {
      const value = args[index + 1];

      if (value === undefined || value.startsWith("--")) {
        return undefined;
      }

      port = parsePort(value);
      index += 1;
      continue;
    }

    if (arg?.startsWith("--port=")) {
      port = parsePort(arg.slice("--port=".length));
      continue;
    }

    return undefined;
  }

  if (port === undefined) {
    return {};
  }

  return Number.isSafeInteger(port) && port > 0 && port <= 65_535 ? { port } : undefined;
}

function parseStartArgs(args: readonly string[]): ParsedStartArgs | undefined {
  let launchHud = false;
  let openBrowser = true;
  let port: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--hud") {
      launchHud = true;
      continue;
    }

    if (arg === "--open") {
      openBrowser = true;
      continue;
    }

    if (arg === "--no-open") {
      openBrowser = false;
      continue;
    }

    if (arg === "--port") {
      const value = args[index + 1];

      if (value === undefined || value.startsWith("--")) {
        return undefined;
      }

      port = parsePort(value);
      index += 1;
      continue;
    }

    if (arg?.startsWith("--port=")) {
      port = parsePort(arg.slice("--port=".length));
      continue;
    }

    return undefined;
  }

  if (port !== undefined && (!Number.isSafeInteger(port) || port <= 0 || port > 65_535)) {
    return undefined;
  }

  return {
    launchHud,
    openBrowser,
    ...(port === undefined ? {} : { port }),
  };
}

function parseHudArgs(args: readonly string[]): ParsedHudArgs | undefined {
  let port: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--port") {
      const value = args[index + 1];

      if (value === undefined || value.startsWith("--")) {
        return undefined;
      }

      port = parsePort(value);
      index += 1;
      continue;
    }

    if (arg?.startsWith("--port=")) {
      port = parsePort(arg.slice("--port=".length));
      continue;
    }

    return undefined;
  }

  if (port !== undefined && (!Number.isSafeInteger(port) || port <= 0 || port > 65_535)) {
    return undefined;
  }

  return port === undefined ? {} : { port };
}

function parsePort(value: string): number {
  return Number.parseInt(value, 10);
}
