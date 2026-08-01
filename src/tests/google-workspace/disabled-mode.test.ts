import { afterEach, describe, expect, it } from "vitest";

describe("GOOGLE_WORKSPACE_MODE=disabled", () => {
  afterEach(async () => {
    delete process.env.GOOGLE_WORKSPACE_MODE;
    const { resetServerEnvCacheForTests } = await import("@/config/env");
    resetServerEnvCacheForTests();
  });

  it("reports unavailable and blocks mutations without revealing secrets", async () => {
    process.env.GOOGLE_WORKSPACE_MODE = "disabled";
    const { resetServerEnvCacheForTests, getGoogleWorkspaceMode } = await import(
      "@/config/env"
    );
    resetServerEnvCacheForTests();
    expect(getGoogleWorkspaceMode()).toBe("disabled");

    const { isGoogleWorkspaceEnabled } = await import(
      "@/server/google-workspace/composition"
    );
    expect(isGoogleWorkspaceEnabled()).toBe(false);

    const { assertGoogleEnabled, googleDisabledJson } = await import(
      "@/server/http/admin-get"
    );
    expect(() => assertGoogleEnabled()).toThrowError(
      /Google Workspace integration is disabled/,
    );

    const response = googleDisabledJson();
    const body = await response.json();
    expect(body).toMatchObject({
      mode: "disabled",
      available: false,
    });
    expect(JSON.stringify(body)).not.toMatch(
      /private_key|client_email|access_token|refresh_token/i,
    );
  });
});
