import type { CliExecutionContext } from "../cli.js";
import {
  DEFAULT_INSTALL_SURFACES,
  formatInstallSurfaces,
  readInstallProfileFile,
  type InstallSurface,
} from "../install-profile.js";

const MODES_USAGE = "Usage: stackspend modes";

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

  context.stdout("StackSpend modes");
  context.stdout(`Platform: ${platformLabel()}`);
  context.stdout(`Install profile: ${formatInstallSurfaces(selectedSurfaces)}${profile === null ? " (recommended default)" : ""}`);
  context.stdout("npm install: npm install -g @stackspend/cli@alpha");
  context.stdout(`Runtime lock: ${runtimeLockHint()}`);
  context.stdout("");
  context.stdout("1. CLI automation");
  context.stdout(`   Status: ${surfaceStatus("cli", selectedSurfaces)} from the npm CLI package`);
  context.stdout("   Try: stackspend doctor");
  context.stdout("   Try: stackspend sync --provider mock");
  context.stdout("");
  context.stdout("2. Local web dashboard/runtime");
  context.stdout(`   Status: ${surfaceStatus("web", selectedSurfaces)} local API runtime is available from the npm CLI package`);
  context.stdout("   Try: stackspend serve [--port <port>]");
  context.stdout("   Try: stackspend dashboard check");
  context.stdout("   Note: the full Next.js dashboard is run from the repo or a future bundled desktop app.");
  context.stdout("");
  context.stdout("3. Desktop tray/notifier");
  context.stdout(`   Status: ${surfaceStatus("hud", selectedSurfaces)} macOS target is the thin Tauri tray shell; the native tray binary is not bundled in @stackspend/cli`);
  context.stdout("   Try: stackspend desktop status");
  context.stdout("   Try: stackspend notify once --dry-run");
  context.stdout("");
  context.stdout("Change selection: stackspend install");
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
    return "~/Library/Application Support/StackSpend/runtime.json";
  }

  if (process.platform === "win32") {
    return "%APPDATA%\\StackSpend\\runtime.json";
  }

  return "${XDG_CONFIG_HOME:-~/.config}/stackspend/runtime.json";
}
