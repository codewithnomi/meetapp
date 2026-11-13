import { describe, expect, it } from "vitest";
import { firstStart, startsHidden, validSwitch, type LoginSystem } from "./login-item.ts";

function fakeSystem(on = false) {
  const calls: boolean[] = [];
  const system: LoginSystem = { isOn: () => on, set: (next) => (calls.push(next), (on = next)) };
  return { system, calls };
}

const facts = { argv: [] as string[], openedAtLogin: false, secondsSinceLogin: undefined, hasLink: false };

describe("start at login (F04 T5)", () => {
  it("TC-F04-19 [AC-F04-08, AC-F04-09] the first start turns it on once; later starts and the switch keep the person's choice", () => {
    const { system, calls } = fakeSystem();
    const saved = firstStart({}, system);
    expect(saved).toEqual({ loginItemSet: true });
    expect(calls).toEqual([true]);
    system.set(false);
    expect(firstStart(saved ?? {}, system)).toBeUndefined();
    expect(system.isOn()).toBe(false);
    system.set(true);
    expect(calls).toEqual([true, false, true]);
  });

  it("TC-F04-20 [AC-F04-08] --hidden, the system's login flag, or a start within 60 s of login stays hidden", () => {
    expect(startsHidden({ ...facts, argv: ["MeetApp", "--hidden"] })).toBe(true);
    expect(startsHidden({ ...facts, openedAtLogin: true })).toBe(true);
    expect(startsHidden({ ...facts, secondsSinceLogin: 12 })).toBe(true);
    expect(startsHidden({ ...facts, secondsSinceLogin: 600 })).toBe(false);
    expect(startsHidden(facts)).toBe(false);
  });

  it("TC-F04-20 [AC-F04-10] a start with a meeting link always shows the window", () => {
    expect(startsHidden({ ...facts, argv: ["--hidden"], hasLink: true })).toBe(false);
  });

  it("only true or false reaches the system", () => {
    expect(validSwitch(true)).toBe(true);
    expect(validSwitch("yes")).toBe(false);
  });
});
