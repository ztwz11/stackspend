import { describe, expect, it } from "vitest";
import { desktopBackgroundSpawnOptions } from "./desktop-runtime.js";

describe("desktop runtime launcher", () => {
  it("detaches Windows runtime processes while hiding their console windows", () => {
    expect(desktopBackgroundSpawnOptions("win32")).toEqual({
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
  });

  it("detaches runtime processes on POSIX platforms", () => {
    expect(desktopBackgroundSpawnOptions("darwin")).toEqual({
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    expect(desktopBackgroundSpawnOptions("linux")).toEqual({
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
  });
});
