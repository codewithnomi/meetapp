// The folded side menu is remembered (TC-F14-81, AC-F14-36).
import { describe, expect, it } from "vitest";
import { readFolded, writeFolded } from "./nav-folded.ts";

function memory(initial?: string) {
  const values = new Map<string, string>(initial === undefined ? [] : [["meetapp.nav.folded", initial]]);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("the folded menu choice", () => {
  it("TC-F14-81 [AC-F14-36] stored true/false is used; garbage or nothing means unfolded", () => {
    expect(readFolded(memory("true"))).toBe(true);
    expect(readFolded(memory("false"))).toBe(false);
    expect(readFolded(memory("yes please"))).toBe(false);
    expect(readFolded(memory())).toBe(false);
    expect(readFolded(undefined)).toBe(false);
    const store = memory();
    writeFolded(true, store);
    expect(readFolded(store)).toBe(true);
  });
});
