import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_INSTALL_SURFACES,
  formatInstallSurfaces,
  readInstallProfileFile,
  resolveInstallProfilePath,
  writeInstallProfileFile,
} from "./install-profile.js";
import { parseInstallSurfaceSelection } from "./install-selector.js";

describe("StackSpend install profile", () => {
  it("defaults npm setup selection to CLI, web dashboard, and HUD", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "stackspend-install-"));
    const profilePath = join(cwd, "install-profile.json");
    const profile = await writeInstallProfileFile({
      selectedSurfaces: DEFAULT_INSTALL_SURFACES,
      source: "postinstall",
      recommendedDefault: true,
    }, {
      env: {
        STACKSPEND_INSTALL_PROFILE_PATH: profilePath,
      },
      now: () => new Date("2026-06-12T00:00:00.000Z"),
    });

    expect(profile.selectedSurfaces).toEqual(["cli", "web", "hud"]);
    expect(profile.localOnly).toBe(true);
    expect(profile.secretsReturned).toBe(false);
    expect(await readInstallProfileFile({
      env: {
        STACKSPEND_INSTALL_PROFILE_PATH: profilePath,
      },
    })).toEqual(profile);
    expect(await readFile(profilePath, "utf8")).not.toMatch(/sk-|hooks\.slack|FAKE_/i);
  });

  it("parses Windows-friendly component selections with Enter meaning all", () => {
    expect(parseInstallSurfaceSelection("")).toEqual(["cli", "web", "hud"]);
    expect(parseInstallSurfaceSelection("1,2,3")).toEqual(["cli", "web", "hud"]);
    expect(parseInstallSurfaceSelection("cli web")).toEqual(["cli", "web"]);
    expect(parseInstallSurfaceSelection("2;3")).toEqual(["web", "hud"]);
    expect(parseInstallSurfaceSelection("bad")).toBeNull();
    expect(formatInstallSurfaces(["cli", "hud"])).toBe("CLI, HUD");
  });

  it("resolves a Windows AppData-style profile path without using the repo cwd", () => {
    const path = resolveInstallProfilePath({
      env: {
        APPDATA: "C:\\Users\\tester\\AppData\\Roaming",
        USERPROFILE: "C:\\Users\\tester",
      },
    });

    expect(path).toContain("StackSpend");
    expect(path).toContain("install-profile.json");
  });
});
