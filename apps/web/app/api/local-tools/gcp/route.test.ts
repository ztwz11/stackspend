import { describe, expect, it, vi } from "vitest";
import { readGcpLocalSetupStatus } from "../../../../lib/local-tools";
import { GET } from "./route";

vi.mock("../../../../lib/local-tools", () => ({
  readGcpLocalSetupStatus: vi.fn(),
}));

const readGcpLocalSetupStatusMock = vi.mocked(readGcpLocalSetupStatus);

describe("GET /api/local-tools/gcp", () => {
  it("returns Google Cloud local setup status without secrets", async () => {
    readGcpLocalSetupStatusMock.mockResolvedValue({
      generatedAt: "2026-06-09T00:00:00.000Z",
      localOnly: true,
      secretsReturned: false,
      gcloudCli: {
        state: "installed",
        version: "548.0.0",
        detail: "Google Cloud SDK 548.0.0",
      },
      account: {
        state: "configured",
        activeAccountHint: "d***@e***.com",
      },
      project: {
        state: "configured",
        projectIdHint: "sta***ct",
      },
      adc: {
        state: "configured",
        source: "application_default_credentials",
        envConfigured: false,
        fileDetected: true,
      },
      docs: {
        installUrl: "https://docs.cloud.google.com/sdk/docs/install",
        authUrl: "https://docs.cloud.google.com/docs/authentication/gcloud",
        adcUrl: "https://docs.cloud.google.com/sdk/gcloud/reference/auth/application-default/login",
      },
      commands: ["gcloud --version"],
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      localOnly: true,
      secretsReturned: false,
      gcloudCli: {
        state: "installed",
      },
      adc: {
        source: "application_default_credentials",
      },
    });
    expect(JSON.stringify(payload)).not.toContain("refresh_token");
    expect(JSON.stringify(payload)).not.toContain("client_secret");
  });
});
