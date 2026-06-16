import type { CliExecutionContext } from "../cli.js";
import {
  DEFAULT_INSTALL_SURFACES,
  formatInstallSurfaces,
  readInstallProfileFile,
  type InstallSurface,
} from "../install-profile.js";

const MODES_USAGE = "Usage: moneysiren modes";

export async function runModesCommand(args: readonly string[], context: CliExecutionContext): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    context.stdout(MODES_USAGE);
    return 0;
  }

  if (args.length > 0) {
    context.stderr(MODES_USAGE);
    return 1;
  }

  const profile = await readInstallProfileFile({
    env: context.env,
  });
  const selectedSurfaces = profile?.selectedSurfaces ?? DEFAULT_INSTALL_SURFACES;

  context.stdout("MoneySiren modes");
  context.stdout(`Platform: ${platformLabel()}`);
  context.stdout(`Install profile: ${formatInstallSurfaces(selectedSurfaces)}${profile === null ? " (recommended default)" : ""}`);
  context.stdout("npm install: npm install -g @moneysiren/cli@alpha");
  context.stdout(`Runtime lock: ${runtimeLockHint()}`);
  context.stdout("");
  context.stdout("1. CLI automation");
  context.stdout(`   Status: ${surfaceStatus("cli", selectedSurfaces)} from the npm CLI package`);
  context.stdout("   Try: moneysiren doctor");
  context.stdout("   Try: moneysiren sync --provider mock");
  context.stdout("");
  context.stdout("2. Local web dashboard/runtime");
  context.stdout(`   Status: ${surfaceStatus("web", selectedSurfaces)} GitHub Release web runtime archive is installed by the CLI`);
  context.stdout("   Install: moneysiren install --web");
  context.stdout("   Try: moneysiren serve [--port <port>]");
  context.stdout("   Try: moneysiren dashboard check");
  context.stdout("   Note: the npm CLI starts the local API; full dashboard runtime ships as a release asset.");
  context.stdout("");
  context.stdout("3. Desktop tray/notifier");
  context.stdout(`   Status: ${surfaceStatus("hud", selectedSurfaces)} Windows/macOS target is the thin Tauri tray shell from GitHub Releases`);
  context.stdout("   Install: moneysiren install --hud");
  context.stdout("   Try: moneysiren desktop status");
  context.stdout("   Try: moneysiren notify once --dry-run");
  context.stdout("");
  context.stdout("Install recommended set: moneysiren install --all");
  context.stdout("Change selection only: moneysiren install --profile-only");
  return 0;
}

function surfaceStatus(surface: InstallSurface, selectedSurfaces: readonly InstallSurface[]): string {
  return selectedSurfaces.includes(surface) ? "selected;" : "not selected;";
}

function platformLabel(): string {
  if (process.platform === "darwin") {
    return `macOS (${process.platform} ${process.arch})`;
  }

  if (process.platform === "win32") {
    return `Windows (${process.platform} ${process.arch})`;
  }

  if (process.platform === "linux") {
    return `Linux (${process.platform} ${process.arch})`;
  }

  return `${process.platform} ${process.arch}`;
}

function runtimeLockHint(): string {
  if (process.platform === "darwin") {
    return "~/Library/Application Support/MoneySiren/runtime.json";
  }

  if (process.platform === "win32") {
    return "%APPDATA%\\MoneySiren\\runtime.json";
  }

  return "${XDG_CONFIG_HOME:-~/.config}/moneysiren/runtime.json";
}
