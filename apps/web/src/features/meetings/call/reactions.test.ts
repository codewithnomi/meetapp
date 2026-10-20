// Reactions (AC-F02-24): only the five names pass, and one a second per person.
import { describe, expect, it } from "vitest";
import { createGate, decodeReaction, encodeReaction } from "./reactions.ts";

describe("reactions", () => {
  it("TC-F02-48 [AC-F02-24] a known reaction round-trips; anything else is ignored", () => {
    expect(decodeReaction(encodeReaction("applause"))).toBe("applause");
    expect(decodeReaction(new TextEncoder().encode('{"reaction":"<script>"}'))).toBeUndefined();
    expect(decodeReaction(new TextEncoder().encode("not json"))).toBeUndefined();
  });

  it("TC-F02-48 [AC-F02-24] at most one a second from the same person", () => {
    let now = 0;
    const gate = createGate(() => now);
    expect(gate("a")).toBe(true);
    now = 500;
    expect([gate("a"), gate("b")]).toEqual([false, true]);
    now = 1_100;
    expect(gate("a")).toBe(true);
  });
});
