// TC-F00-67, TC-F00-68: license rules (blocked, unknown, SPDX expressions, allowlist).
import { describe, expect, it } from "vitest";
import { APPROVED_LICENSES, findLicenseProblems, licenseVerdict, packagesFromPnpm } from "./licenses.ts";

const pkg = (name: string, license: string, version = "1.0.0") => ({ name, version, license });

describe("TC-F00-67 [AC-F00-31] blocked and unknown licenses fail", () => {
  it.each(["GPL-3.0", "AGPL-3.0", "LGPL-2.1", "SSPL-1.0", "GPL-2.0-only", "GPL-3.0-or-later", "GPL-2.0+"])(
    "TC-F00-67 [AC-F00-31] %s is blocked",
    (id) => {
      expect(licenseVerdict(id)).toEqual({ ok: false, reason: expect.stringContaining("blocked") });
    },
  );

  it.each(["", "UNLICENSED", "Unknown", "MIT AND ("])("TC-F00-67 [AC-F00-31] %j is unknown", (id) => {
    expect(licenseVerdict(id)).toEqual({ ok: false, reason: expect.stringContaining("unknown") });
  });

  it("TC-F00-67 [AC-F00-31] each bad package is named with its license", () => {
    const lines = findLicenseProblems(
      [
        pkg("a-gpl", "GPL-3.0"),
        pkg("b-agpl", "AGPL-3.0"),
        pkg("c-lgpl", "LGPL-2.1"),
        pkg("d-sspl", "SSPL-1.0"),
        pkg("e-odd", "Weird-1.0"),
        pkg("ok", "MIT"),
      ],
      [],
    );
    expect(lines).toHaveLength(5);
    for (const n of ["a-gpl@1.0.0", "b-agpl", "c-lgpl", "d-sspl", "e-odd"]) {
      expect(lines.join("\n")).toContain(n);
    }
    expect(lines.join("\n")).toContain("GPL-3.0");
    expect(lines.join("\n")).not.toContain("ok@");
  });

  it("TC-F00-67 [AC-F00-31] approved ids pass", () => {
    for (const id of APPROVED_LICENSES) expect(licenseVerdict(id)).toEqual({ ok: true });
    expect(APPROVED_LICENSES.has("MIT")).toBe(true);
  });
});

describe("TC-F00-68 [AC-F00-31] expressions and allowlist", () => {
  it("TC-F00-68 [AC-F00-31] OR passes if any side passes", () => {
    expect(licenseVerdict("MIT OR GPL-3.0").ok).toBe(true);
    expect(licenseVerdict("GPL-3.0 OR MIT").ok).toBe(true);
    expect(licenseVerdict("GPL-3.0 OR AGPL-3.0").ok).toBe(false);
  });

  it("TC-F00-68 [AC-F00-31] AND needs both sides", () => {
    expect(licenseVerdict("(MIT AND GPL-3.0)").ok).toBe(false);
    expect(licenseVerdict("MIT AND ISC").ok).toBe(true);
  });

  it("TC-F00-68 [AC-F00-31] WITH exception is judged by the license", () => {
    expect(licenseVerdict("Apache-2.0 WITH LLVM-exception").ok).toBe(true);
    expect(licenseVerdict("GPL-3.0 WITH Classpath-exception-2.0").ok).toBe(false);
  });

  it("TC-F00-68 [AC-F00-31] keywords are case-insensitive and parentheses nest", () => {
    expect(licenseVerdict("mit or gpl-3.0").ok).toBe(true);
    expect(licenseVerdict("(MIT OR GPL-3.0) AND (ISC OR AGPL-3.0)").ok).toBe(true);
    expect(licenseVerdict("(MIT OR GPL-3.0) AND (GPL-2.0 OR AGPL-3.0)").ok).toBe(false);
  });

  it("TC-F00-68 [AC-F00-31] allowlisted package with a reason passes", () => {
    const list = [{ name: "x", license: "GPL-3.0", reason: "dev tool only" }];
    expect(findLicenseProblems([pkg("x", "GPL-3.0")], list)).toEqual([]);
  });

  it("TC-F00-68 [AC-F00-31] allowlist entry without a reason does not count", () => {
    for (const reason of ["", "   "]) {
      const list = [{ name: "x", license: "GPL-3.0", reason }];
      expect(findLicenseProblems([pkg("x", "GPL-3.0")], list)).toHaveLength(1);
    }
  });

  it("TC-F00-68 [AC-F00-31] allowlist entry for a different license or name does not count", () => {
    const list = [{ name: "x", license: "MIT", reason: "because" }];
    expect(findLicenseProblems([pkg("x", "GPL-3.0")], list)).toHaveLength(1);
    const other = [{ name: "y", license: "GPL-3.0", reason: "because" }];
    expect(findLicenseProblems([pkg("x", "GPL-3.0")], other)).toHaveLength(1);
  });

  it("TC-F00-68 [AC-F00-31] packagesFromPnpm gives one entry per version", () => {
    const out = packagesFromPnpm({
      MIT: [{ name: "a", versions: ["1.0.0", "2.0.0"], license: "MIT" }],
      "GPL-3.0": [{ name: "b", versions: ["3.0.0"], license: "GPL-3.0" }],
    });
    expect(out).toHaveLength(3);
    expect(out).toContainEqual({ name: "a", version: "2.0.0", license: "MIT" });
    expect(out).toContainEqual({ name: "b", version: "3.0.0", license: "GPL-3.0" });
    expect(packagesFromPnpm({})).toEqual([]);
  });
});
