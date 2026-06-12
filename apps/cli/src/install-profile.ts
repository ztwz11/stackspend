import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

export const INSTALL_SURFACES = ["cli", "web", "hud"] as const;
export const DEFAULT_INSTALL_SURFACES: readonly InstallSurface[] = INSTALL_SURFACES;

export type InstallSurface = (typeof INSTALL_SURFACES)[number];
export type InstallProfileSource = "cli" | "postinstall";

export interface InstallProfile {
  version: 1;
  selectedSurfaces: readonly InstallSurface[];
  recommendedDefault: boolean;
  localOnly: true;
  secretsReturned: false;
  source: InstallProfileSource;
  installedAt: string;
  updatedAt: string;
}

export interface InstallProfileFileOptions {
  env?: Record<string, string | undefined>;
  now?: () => Date;
  path?: string;
}

const INSTALL_PROFILE_ENV_KEY = "STACKSPEND_INSTALL_PROFILE_PATH";

export function resolveInstallProfilePath(options: InstallProfileFileOptions = {}): string {
  if (options.path !== undefined && options.path.trim().length > 0) {
    return resolveInstallPath(options.path, process.cwd());
  }

  const env = options.env ?? process.env;
  const configuredPath = env[INSTALL_PROFILE_ENV_KEY];

  if (configuredPath !== undefined && configuredPath.trim().length > 0) {
    return resolveInstallPath(configuredPath, process.cwd());
  }

  return defaultInstallProfilePath(env);
}

export async function readInstallProfileFile(
  options: InstallProfileFileOptions = {},
): Promise<InstallProfile | null> {
  try {
    return parseInstallProfile(JSON.parse(await readFile(resolveInstallProfilePath(options), "utf8")));
  } catch {
    return null;
  }
}

export async function writeInstallProfileFile(input: {
  selectedSurfaces: readonly InstallSurface[];
  source: InstallProfileSource;
  recommendedDefault?: boolean;
}, options: InstallProfileFileOptions = {}): Promise<InstallProfile> {
  const existing = await readInstallProfileFile(options);
  const now = (options.now ?? (() => new Date()))().toISOString();
  const profile: InstallProfile = {
    version: 1,
    selectedSurfaces: normalizeInstallSurfaces(input.selectedSurfaces),
    recommendedDefault: input.recommendedDefault ?? isRecommendedInstallSelection(input.selectedSurfaces),
    localOnly: true,
    secretsReturned: false,
    source: input.source,
    installedAt: existing?.installedAt ?? now,
    updatedAt: now,
  };
  const path = resolveInstallProfilePath(options);

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  return profile;
}

export function parseInstallProfile(value: unknown): InstallProfile | null {
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }

  const selectedSurfaces = parseInstallSurfaces(value.selectedSurfaces);

  if (selectedSurfaces.length === 0) {
    return null;
  }

  return {
    version: 1,
    selectedSurfaces,
    recommendedDefault: typeof value.recommendedDefault === "boolean"
      ? value.recommendedDefault
      : isRecommendedInstallSelection(selectedSurfaces),
    localOnly: true,
    secretsReturned: false,
    source: value.source === "postinstall" ? "postinstall" : "cli",
    installedAt: typeof value.installedAt === "string" ? value.installedAt : "",
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  };
}

export function parseInstallSurfaces(value: unknown): readonly InstallSurface[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return normalizeInstallSurfaces(value.filter(isInstallSurface));
}

export function normalizeInstallSurfaces(values: readonly InstallSurface[]): readonly InstallSurface[] {
  const selected = new Set(values);

  return INSTALL_SURFACES.filter((surface) => selected.has(surface));
}

export function isRecommendedInstallSelection(values: readonly InstallSurface[]): boolean {
  const selected = normalizeInstallSurfaces(values);

  return selected.length === INSTALL_SURFACES.length &&
    INSTALL_SURFACES.every((surface, index) => selected[index] === surface);
}

export function formatInstallSurfaces(values: readonly InstallSurface[]): string {
  return normalizeInstallSurfaces(values).map(installSurfaceLabel).join(", ");
}

export function installSurfaceLabel(surface: InstallSurface): string {
  if (surface === "cli") {
    return "CLI";
  }

  if (surface === "web") {
    return "Web dashboard";
  }

  return "HUD";
}

export function isInstallSurface(value: unknown): value is InstallSurface {
  return typeof value === "string" && INSTALL_SURFACES.includes(value as InstallSurface);
}

function defaultInstallProfilePath(env: Record<string, string | undefined>): string {
  if (process.platform === "darwin") {
    return join(resolveHomeDirectory(env), "Library", "Application Support", "StackSpend", "install-profile.json");
  }

  if (process.platform === "win32") {
    return join(resolveWindowsAppDataDirectory(env), "StackSpend", "install-profile.json");
  }

  const configHome = trimToNull(env.XDG_CONFIG_HOME) ?? join(resolveHomeDirectory(env), ".config");

  return join(configHome, "stackspend", "install-profile.json");
}

function resolveInstallPath(path: string, cwd: string): string {
  return isAbsolute(path) ? path : join(cwd, path);
}

function resolveWindowsAppDataDirectory(env: Record<string, string | undefined>): string {
  return trimToNull(env.APPDATA) ?? join(resolveHomeDirectory(env), "AppData", "Roaming");
}

function resolveHomeDirectory(env: Record<string, string | undefined>): string {
  return trimToNull(env.HOME) ?? trimToNull(env.USERPROFILE) ?? homedir();
}

function trimToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
