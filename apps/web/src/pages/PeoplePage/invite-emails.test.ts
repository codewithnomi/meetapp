// The "Email addresses" field (TC-F01-48, AC-F01-17): separators, duplicates, case, the limit of 20 and
// a mistyped address.
import { describe, expect, it } from "vitest";
import { MAX_INVITES, parseEmails } from "./invite-emails.ts";

describe("parseEmails", () => {
  it("TC-F01-48 [AC-F01-17] splits on commas, semicolons, spaces and lines; trims, lower-cases, drops repeats", () => {
    expect(parseEmails(" Sara@Example.com, bilal@example.com;\nsara@example.com  hina@example.com ")).toEqual({
      ok: true,
      emails: ["sara@example.com", "bilal@example.com", "hina@example.com"],
    });
  });

  it("TC-F01-48 [AC-F01-17] empty, too many and a mistyped address are refused before sending", () => {
    expect(parseEmails(" , ")).toEqual({ ok: false, problem: "empty" });
    const many = Array.from({ length: MAX_INVITES + 1 }, (_, i) => `p${String(i)}@example.com`).join(",");
    expect(parseEmails(many)).toEqual({ ok: false, problem: "tooMany" });
    expect(parseEmails("sara@example.com, bilal@")).toEqual({ ok: false, problem: "badEmail", email: "bilal@" });
  });
});
