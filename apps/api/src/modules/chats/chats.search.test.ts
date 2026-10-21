// Name search in the chat list (F14 TC-F14-06, AC-F14-04).
import { describe, expect, it } from "vitest";
import { matchesNames } from "./chats.search.ts";

describe("matchesNames", () => {
  it("TC-F14-06 [AC-F14-04] every word must match a name, in any order, ignoring case and accents", () => {
    const names = ["José Álvarez", "Anna Lee"];
    for (const query of ["jose", "ALVAREZ jose", "lee anna", "jose lee"]) expect(matchesNames(query, names)).toBe(true);
    expect(matchesNames("joseph", names)).toBe(false);
    expect(matchesNames("   ", names)).toBe(true);
  });
});
