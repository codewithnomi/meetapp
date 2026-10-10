// The container check's command lines (AC-F00-39, TC-F00-81): settings come from .env at run time, the
// port is published on this computer only, and the secret scan runs read-only without network.
import { describe, expect, it } from "vitest";
import { CONTAINER, IMAGE, SERVICES_NETWORK, buildArgs, runArgs, secretScanArgs } from "./container-commands.ts";

describe("TC-F00-81 [AC-F00-39] container check commands", () => {
  it("TC-F00-81 [AC-F00-39] builds the backend image from apps/api/Dockerfile at the repository root", () => {
    expect(buildArgs("/repo")).toEqual(["build", "-f", "/repo/apps/api/Dockerfile", "-t", IMAGE, "/repo"]);
  });

  it("TC-F00-81 [AC-F00-39] runs with settings from .env on the services' network, port on 127.0.0.1", () => {
    const args = runArgs("/repo/.env", 4321).join(" ");
    expect(args).toContain(`--name ${CONTAINER}`);
    expect(args).toContain("--env-file /repo/.env");
    expect(args).toContain(`--network ${SERVICES_NETWORK}`);
    for (const pair of ["POSTGRES_HOST=postgres", "POSTGRES_PORT=5432", "REDIS_HOST=redis", "REDIS_PORT=6379"])
      expect(args).toContain(`-e ${pair}`);
    for (const pair of ["LIVEKIT_HOST=livekit", "STORAGE_HOST=storage", "MAILPIT_HOST=mailpit"])
      expect(args).toContain(`-e ${pair}`);
    expect(args).toContain("-p 127.0.0.1:4321:3000");
    expect(args).toContain("-e NODE_ENV=production");
  });

  it("TC-F00-81 [AC-F00-39] scans the image's files read-only and offline", () => {
    const args = secretScanArgs("gitleaks:pinned", "/tmp/x/app", "/repo/.gitleaks.toml").join(" ");
    expect(args).toContain("--network none");
    expect(args).toContain("-v /tmp/x/app:/scan:ro");
    expect(args).toContain("gitleaks:pinned dir /scan");
  });
});
