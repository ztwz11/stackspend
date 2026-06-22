import { execFile, spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import type { CliExecutionContext } from "./cli.js";
import { resolveReleaseInstallDir } from "./release-installer.js";

const execFileAsync = promisify(execFile);
const DEFAULT_WEB_PORT = 3000;
const DEFAULT_HEALTH_TIMEOUT_MS = 30_000;

export interface StartWebRuntimeOptions {
  openBrowser: boolean;
  port?: number;
}

export interface StartHudOptions {
  port?: number;
}

export type DesktopRuntimeResult =
  | {
      status: "running" | "started";
      dashboardUrl: string;
      pid?: number;
      notes: readonly string[];
    }
  | DesktopRuntimeUnavailableResult;

export type DesktopShellResult =
  | {
      status: "opened" | "started";
      executablePath: string;
      pid?: number;
      notes: readonly string[];
    }
  | DesktopRuntimeUnavailableResult;

export interface DesktopRuntimeUnavailableResult {
  status: "unavailable";
  reason: string;
  guidance: readonly string[];
}

export interface CliDesktopRuntimeAdapter {
  startWebRuntime(options: StartWebRuntimeOptions): Promise<DesktopRuntimeResult>;
  startHud(options: StartHudOptions): Promise<DesktopShellResult>;
}

interface InstallManifest {
  assets: readonly InstallManifestAsset[];
}

interface InstallManifestAsset {
  surface: "web" | "hud";
  name: string;
  path: string;
}

interface ResolvedExecutable {
  command: string;
  args: readonly string[];
  executablePath: string;
  cwd?: string;
}

export function createFallbackDesktopRuntimeAdapter(context: CliExecutionContext): CliDesktopRuntimeAdapter {
  return {
    async startWebRuntime(options) {
      const port = options.port ?? configuredPort(context.env);
      const dashboardUrl = `http://127.0.0.1:${port}/ko/dashboard/overview`;
      const healthUrl = `http://127.0.0.1:${port}/api/local/health`;

      if (await isWebRuntimeHealthy(healthUrl, context.fetch)) {
        return {
          status: "running",
          dashboardUrl,
          notes: ["Existing local dashboard runtime is healthy."],
        };
      }

      const startScript = await resolveWebRuntimeStartScript(context);

      if (startScript.status === "unavailable") {
        return startScript;
      }

      const child = spawn(process.execPath, [startScript.path], {
        cwd: dirname(startScript.path),
        detached: true,
        env: {
          ...process.env,
          ...context.env,
          HOSTNAME: "127.0.0.1",
          PORT: String(port),
        },
        stdio: "ignore",
        windowsHide: true,
      });

      child.unref();

      if (!await waitForWebRuntime(healthUrl, context.fetch, DEFAULT_HEALTH_TIMEOUT_MS)) {
        return {
          status: "unavailable",
          reason: "Started the local web runtime, but the health check did not become ready.",
          guidance: [
            `Check ${dashboardUrl} in your browser.`,
            "If the port is already in use, run `msiren start --port <port>`.",
          ],
        };
      }

      return {
        status: "started",
        dashboardUrl,
        ...(child.pid === undefined ? {} : { pid: child.pid }),
        notes: startScript.notes,
      };
    },

    async startHud(options) {
      const executable = await resolveDesktopExecutable(context);

      if (isUnavailable(executable)) {
        return executable;
      }

      const child = spawn(executable.command, executable.args, {
        ...(executable.cwd === undefined ? {} : { cwd: executable.cwd }),
        detached: true,
        env: {
          ...process.env,
          ...context.env,
          MONEYSIREN_DESKTOP_MODE: "hud",
          MONEYSIREN_WEB_URL: `http://127.0.0.1:${options.port ?? configuredPort(context.env)}`,
        },
        stdio: "ignore",
        windowsHide: true,
      });

      child.unref();

      return {
        status: "started",
        executablePath: executable.executablePath,
        ...(child.pid === undefined ? {} : { pid: child.pid }),
        notes: ["Desktop HUD shell launched with MONEYSIREN_DESKTOP_MODE=hud."],
      };
    },
  };
}

async function resolveWebRuntimeStartScript(context: CliExecutionContext): Promise<
  | {
      status: "ready";
      path: string;
      notes: readonly string[];
    }
  | DesktopRuntimeUnavailableResult
> {
  const configured = trimToNull(context.env.MONEYSIREN_WEB_RUNTIME_DIR);

  if (configured !== null) {
    const configuredStart = await findStartScript(resolve(context.cwd, configured));

    if (configuredStart !== null) {
      return {
        status: "ready",
        path: configuredStart,
        notes: ["Using MONEYSIREN_WEB_RUNTIME_DIR."],
      };
    }

    return {
      status: "unavailable",
      reason: "MONEYSIREN_WEB_RUNTIME_DIR does not contain a MoneySiren web runtime.",
      guidance: [
        "Point MONEYSIREN_WEB_RUNTIME_DIR at the extracted moneysiren-web-runtime directory.",
        "Or run `msiren install --web` and then `msiren start`.",
      ],
    };
  }

  const installDir = resolveReleaseInstallDir({ env: context.env });
  const extractedRoot = join(installDir, "web-runtime");
  const existingStart = await findStartScript(extractedRoot) ?? await findStartScript(join(installDir, "moneysiren-web-runtime"));

  if (existingStart !== null) {
    return {
      status: "ready",
      path: existingStart,
      notes: ["Using previously extracted GitHub Release web runtime."],
    };
  }

  const manifest = await readInstallManifest(installDir);
  const webAsset = manifest?.assets.find((asset) => asset.surface === "web");

  if (webAsset === undefined) {
    return {
      status: "unavailable",
      reason: "No installed web runtime asset was found.",
      guidance: [
        "Install the release web runtime first: `msiren install --web` or `msiren install --all`.",
        "If you already extracted it manually, set MONEYSIREN_WEB_RUNTIME_DIR to that directory.",
      ],
    };
  }

  if (!await pathExists(webAsset.path)) {
    return {
      status: "unavailable",
      reason: "The installed web runtime archive listed in the manifest is missing.",
      guidance: [
        "Run `msiren install --web` again.",
        "If you moved the runtime, set MONEYSIREN_WEB_RUNTIME_DIR to the extracted directory.",
      ],
    };
  }

  try {
    await mkdir(extractedRoot, { recursive: true });
    await execFileAsync("tar", ["-xzf", webAsset.path, "-C", extractedRoot], {
      windowsHide: true,
      timeout: 120_000,
    });
  } catch (error) {
    return {
      status: "unavailable",
      reason: `Could not extract the installed web runtime archive: ${errorMessage(error)}`,
      guidance: [
        "Install a system tar command, or extract the moneysiren-web-runtime archive manually.",
        "Then set MONEYSIREN_WEB_RUNTIME_DIR to the extracted directory and rerun `msiren start`.",
      ],
    };
  }

  const extractedStart = await findStartScript(extractedRoot);

  if (extractedStart === null) {
    return {
      status: "unavailable",
      reason: "The extracted web runtime did not contain start.mjs.",
      guidance: [
        "Run `msiren install --web` again.",
        "If this repeats, the GitHub Release web runtime asset is incomplete.",
      ],
    };
  }

  return {
    status: "ready",
    path: extractedStart,
    notes: ["Extracted GitHub Release web runtime automatically."],
  };
}

async function resolveDesktopExecutable(context: CliExecutionContext): Promise<ResolvedExecutable | DesktopRuntimeUnavailableResult> {
  const configured = trimToNull(context.env.MONEYSIREN_DESKTOP_APP);

  if (configured !== null) {
    const executable = await executableFromPath(resolve(context.cwd, configured), true);

    if (executable !== null) {
      return executable;
    }

    return {
      status: "unavailable",
      reason: "MONEYSIREN_DESKTOP_APP does not point to a runnable MoneySiren desktop app.",
      guidance: [
        "Set MONEYSIREN_DESKTOP_APP to the installed MoneySiren executable or macOS .app bundle.",
        "Or run `msiren install --hud` and use a release desktop artifact.",
      ],
    };
  }

  const installedExecutable = await findInstalledDesktopApp(context.env);

  if (installedExecutable !== null) {
    return installedExecutable;
  }

  const installDir = resolveReleaseInstallDir({ env: context.env });
  const manifest = await readInstallManifest(installDir);
  const hudAsset = manifest?.assets.find((asset) => asset.surface === "hud");

  if (hudAsset === undefined) {
    return {
      status: "unavailable",
      reason: "No installed HUD desktop artifact was found.",
      guidance: [
        "Install the desktop artifact first: `msiren install --hud` or `msiren install --all`.",
        "If MoneySiren is already installed, set MONEYSIREN_DESKTOP_APP to the app path.",
      ],
    };
  }

  if (!await pathExists(hudAsset.path)) {
    return {
      status: "unavailable",
      reason: "The installed HUD artifact listed in the manifest is missing.",
      guidance: [
        "Run `msiren install --hud` again.",
        "If the desktop app is installed elsewhere, set MONEYSIREN_DESKTOP_APP to that path.",
      ],
    };
  }

  const executable = await executableFromPath(hudAsset.path, false);

  if (executable !== null) {
    return executable;
  }

  return {
    status: "unavailable",
    reason: "The installed HUD artifact is an installer or archive, not a directly runnable desktop shell.",
    guidance: [
      "Run the downloaded desktop installer once, then rerun `msiren hud`.",
      "If the installed app is not found automatically, set MONEYSIREN_DESKTOP_APP to the executable or .app path.",
      "Portable desktop artifacts can be launched directly by `msiren hud` when published.",
    ],
  };
}

async function executableFromPath(path: string, allowInstaller: boolean): Promise<ResolvedExecutable | null> {
  const pathStat = await stat(path).catch(() => null);

  if (pathStat === null) {
    return null;
  }

  if (process.platform === "darwin" && pathStat.isDirectory() && path.endsWith(".app")) {
    const executable = await findMacAppExecutable(path);

    return executable === null
      ? null
      : {
          command: executable,
          args: [],
          executablePath: path,
          cwd: dirname(executable),
        };
  }

  if (pathStat.isDirectory()) {
    const startScript = await findStartScript(path);

    return startScript === null
      ? null
      : {
          command: process.execPath,
          args: [startScript],
          executablePath: startScript,
          cwd: dirname(startScript),
        };
  }

  if (process.platform === "darwin" && /\.tar\.gz$/i.test(path)) {
    const extractRoot = join(dirname(path), "desktop");

    await mkdir(extractRoot, { recursive: true });
    await execFileAsync("tar", ["-xzf", path, "-C", extractRoot], {
      windowsHide: true,
      timeout: 120_000,
    }).catch(() => undefined);

    const app = await findFirstMacApp(extractRoot);

    return app === null ? null : executableFromPath(app, allowInstaller);
  }

  if (process.platform === "win32" && /\.(exe)$/i.test(path)) {
    const fileName = basename(path).toLowerCase();

    if (!allowInstaller && /(setup|install|installer)/i.test(fileName)) {
      return null;
    }

    return {
      command: path,
      args: [],
      executablePath: path,
      cwd: dirname(path),
    };
  }

  return null;
}

async function findInstalledDesktopApp(env: Record<string, string | undefined>): Promise<ResolvedExecutable | null> {
  if (process.platform === "win32") {
    const roots = [
      trimToNull(env.LOCALAPPDATA),
      trimToNull(env.ProgramFiles),
      trimToNull(env["ProgramFiles(x86)"]),
    ].filter((value): value is string => value !== null);
    const candidates = roots.flatMap((root) => [
      join(root, "Programs", "MoneySiren Tray", "MoneySiren Tray.exe"),
      join(root, "Programs", "MoneySiren Tray", "moneysiren-tray.exe"),
      join(root, "MoneySiren Tray", "MoneySiren Tray.exe"),
      join(root, "MoneySiren Tray", "moneysiren-tray.exe"),
    ]);

    for (const candidate of candidates) {
      const executable = await executableFromPath(candidate, true);

      if (executable !== null) {
        return executable;
      }
    }
  }

  if (process.platform === "darwin") {
    return await executableFromPath("/Applications/MoneySiren Tray.app", true);
  }

  return null;
}

async function readInstallManifest(installDir: string): Promise<InstallManifest | null> {
  try {
    const parsed = JSON.parse(await readFile(join(installDir, "install-manifest.json"), "utf8")) as unknown;

    if (!isRecord(parsed) || !Array.isArray(parsed.assets)) {
      return null;
    }

    return {
      assets: parsed.assets.filter(isInstallManifestAsset),
    };
  } catch {
    return null;
  }
}

function isInstallManifestAsset(value: unknown): value is InstallManifestAsset {
  return isRecord(value) &&
    (value.surface === "web" || value.surface === "hud") &&
    typeof value.name === "string" &&
    typeof value.path === "string";
}

function isUnavailable(value: ResolvedExecutable | DesktopRuntimeUnavailableResult): value is DesktopRuntimeUnavailableResult {
  return "status" in value && value.status === "unavailable";
}

async function findStartScript(root: string): Promise<string | null> {
  const candidates = [
    join(root, "start.mjs"),
    join(root, "moneysiren-web-runtime", "start.mjs"),
  ];

  for (const candidate of candidates) {
    if (await isReadableFile(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function findFirstMacApp(root: string): Promise<string | null> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    const path = join(root, entry.name);

    if (entry.isDirectory() && extname(entry.name) === ".app") {
      return path;
    }

    if (entry.isDirectory()) {
      const nested = await findFirstMacApp(path);

      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
}

async function findMacAppExecutable(appPath: string): Promise<string | null> {
  const macOsDir = join(appPath, "Contents", "MacOS");
  const entries = await readdir(macOsDir, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    const path = join(macOsDir, entry.name);

    if (entry.isFile() && await isExecutableFile(path)) {
      return path;
    }
  }

  return null;
}

async function waitForWebRuntime(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isWebRuntimeHealthy(url, fetchImpl)) {
      return true;
    }

    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 1_000));
  }

  return false;
}

async function isWebRuntimeHealthy(url: string, fetchImpl: typeof fetch): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);

  try {
    const response = await fetchImpl(url, {
      cache: "no-store",
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function isReadableFile(path: string): Promise<boolean> {
  try {
    const pathStat = await stat(path);

    if (!pathStat.isFile()) {
      return false;
    }

    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function isExecutableFile(path: string): Promise<boolean> {
  try {
    const pathStat = await stat(path);

    if (!pathStat.isFile()) {
      return false;
    }

    await access(path, constants.X_OK);
    return true;
  } catch {
    return process.platform === "win32" && /\.(exe|cmd|bat)$/i.test(path);
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function configuredPort(env: Record<string, string | undefined>): number {
  const parsed = Number.parseInt(env.PORT ?? "", 10);

  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : DEFAULT_WEB_PORT;
}

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
