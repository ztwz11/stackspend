import { spawn } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => ({
    unref: vi.fn(),
  })),
}));

const spawnMock = vi.mocked(spawn);

beforeEach(() => {
  spawnMock.mockClear();
});

describe("POST /api/local/open-external", () => {
  it("opens only sanitized local dashboard paths", async () => {
    const response = await POST(localRequest({
      body: JSON.stringify({ path: "/ko/settings/notifications" }),
      method: "POST",
    }));

    expect(response.status).toBe(200);
    expect(spawnMock).toHaveBeenCalledWith(
      expectedOpenCommand(),
      ["http://127.0.0.1:3000/ko/settings/notifications"],
      expect.objectContaining({
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }),
    );
  });

  it("rejects non-local and unsafe paths", async () => {
    for (const path of ["https://example.com", "//example.com", "/ko/settings/notifications\n"]) {
      const response = await POST(localRequest({
        body: JSON.stringify({ path }),
        method: "POST",
      }));

      expect(response.status).toBe(400);
    }

    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("rejects requests from non-local origins", async () => {
    const response = await POST(new Request("http://127.0.0.1:3000/api/local/open-external", {
      body: JSON.stringify({ path: "/ko/settings/notifications" }),
      headers: {
        host: "127.0.0.1:3000",
        origin: "https://example.com",
      },
      method: "POST",
    }));

    expect(response.status).toBe(400);
    expect(spawnMock).not.toHaveBeenCalled();
  });
});

function localRequest(init: RequestInit): Request {
  return new Request("http://127.0.0.1:3000/api/local/open-external", {
    ...init,
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

function expectedOpenCommand(): string {
  if (process.platform === "win32") {
    return "explorer.exe";
  }

  if (process.platform === "darwin") {
    return "open";
  }

  return "xdg-open";
}
