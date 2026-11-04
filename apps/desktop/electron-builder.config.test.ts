import { describe, expect, it } from "vitest";
import { appIdentity } from "./app-identity.ts";
import { builderConfig } from "./electron-builder.config.ts";

describe("installers (F04 T2)", () => {
  it("TC-F04-01 [AC-F04-01, AC-F04-60] builds a universal Mac dmg and Windows x64/arm64 installers from the one identity file", () => {
    const config = builderConfig({});
    expect(config.appId).toBe(appIdentity.appId);
    expect(config.productName).toBe(appIdentity.productName);
    expect(config.icon).toBe(appIdentity.icon);
    expect(config.protocols).toEqual([expect.objectContaining({ schemes: ["meetapp"] })]);
    expect(config.mac?.target).toEqual([{ target: "dmg", arch: "universal" }]);
    expect(config.win?.target).toEqual([{ target: "nsis", arch: ["x64", "arm64"] }]);
    expect(config.publish).toBeNull();
  });

  it("TC-F04-05 [AC-F04-03] signing is only the CSC_LINK setting", () => {
    expect(builderConfig({}).mac?.identity).toBeNull();
    expect(builderConfig({ CSC_LINK: "file:///cert.p12" }).mac?.identity).toBeUndefined();
  });
});
