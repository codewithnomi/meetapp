// Updates switched off (TC-F04-83, AC-F04-50).
import { describe, expect, it, vi } from "vitest";
import { UPDATES_ENABLED, startUpdates } from "./updates.ts";

describe("updates", () => {
  it("TC-F04-83 [AC-F04-50] off: the updater is never loaded or asked; on (test only): asked once", async () => {
    expect(UPDATES_ENABLED).toBe(false);
    const check = vi.fn(() => Promise.resolve());
    const load = vi.fn(() => Promise.resolve({ checkForUpdatesAndNotify: check }));
    expect(await startUpdates(UPDATES_ENABLED, load)).toEqual({ enabled: false });
    expect(load).not.toHaveBeenCalled();
    expect(await startUpdates(true, load)).toEqual({ enabled: true });
    expect(check).toHaveBeenCalledTimes(1);
  });
});
