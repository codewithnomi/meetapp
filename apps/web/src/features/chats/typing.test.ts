// Typing timing (F14 AC-F14-23).
import { describe, expect, it } from "vitest";
import { createTypingList, createTypingSender } from "./typing.ts";

describe("typing", () => {
  it("TC-F14-47 [AC-F14-23] typing for 10 seconds sends at most one signal every 3 seconds", () => {
    let clock = 0;
    const sender = createTypingSender(() => clock);
    let sent = 0;
    for (clock = 0; clock <= 10_000; clock += 100) if (sender.shouldSend()) sent += 1;
    expect(sent).toBe(4); // at 0, 3, 6 and 9 seconds
  });

  it("TC-F14-47 [AC-F14-23] the name shows until 5 seconds after the last signal", () => {
    let clock = 0;
    const list = createTypingList(() => clock);
    list.signal("u1", "Maya");
    clock = 4999;
    expect(list.names()).toEqual(["Maya"]);
    clock = 5000;
    expect(list.names()).toEqual([]);
    list.signal("u1", "Maya");
    list.stopped("u1");
    expect(list.names()).toEqual([]);
  });
});
