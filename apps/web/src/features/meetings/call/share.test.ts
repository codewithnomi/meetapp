// Screen sharing in the desktop app and in a plain browser (AC-F02-25).
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasSharePicker, screenBlocked, shareSources, startShare, stopShare } from "./share.ts";
import { FakeRoom } from "./test-support/fake-room.ts";

const room = () => new FakeRoom() as unknown as Parameters<typeof startShare>[0] & FakeRoom;
const bridge = (media: object | undefined) => vi.stubGlobal("meetapp", media ? { media } : {});
afterEach(() => vi.unstubAllGlobals());

describe("share picker", () => {
  it("TC-F02-49 [AC-F02-25] a plain browser has no picker, no blocks and no sources", async () => {
    bridge(undefined);
    expect(hasSharePicker()).toBe(false);
    expect(await screenBlocked()).toBe(false);
    expect(await shareSources()).toEqual([]);
  });

  it("TC-F02-49 [AC-F02-25] the desktop app has a picker; denied or restricted screen recording blocks", async () => {
    const accessStatus = vi
      .fn()
      .mockResolvedValueOnce({ screen: "denied" })
      .mockResolvedValueOnce({ screen: "granted" });
    bridge({ accessStatus });
    expect(hasSharePicker()).toBe(true);
    expect(await screenBlocked()).toBe(true);
    expect(await screenBlocked()).toBe(false);
    accessStatus.mockResolvedValue({ screen: "restricted" });
    expect(await screenBlocked()).toBe(true);
    accessStatus.mockRejectedValue(new Error("x"));
    expect(await screenBlocked()).toBe(false);
  });

  it("TC-F02-49 [AC-F02-25] the sources come from the desktop app; a failure gives none", async () => {
    const sources = [{ id: "s1", name: "Screen", kind: "screen", thumbnail: "" }];
    const getShareSources = vi.fn().mockResolvedValueOnce(sources).mockRejectedValueOnce(new Error("x"));
    bridge({ getShareSources });
    expect(await shareSources()).toEqual(sources);
    expect(await shareSources()).toEqual([]);
  });
});

describe("starting and stopping", () => {
  it("TC-F02-49 [AC-F02-25] the choice goes to the main process first, then the screen is asked for, without sound", async () => {
    const chooseShareSource = vi.fn(async () => ({ ok: true }));
    bridge({ chooseShareSource });
    const r = room();
    r.localParticipant.setScreenShareEnabled.mockResolvedValue({});
    expect(await startShare(r, "s1")).toBe(true);
    expect(chooseShareSource).toHaveBeenCalledWith("s1");
    expect(r.localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(true, { audio: false });
  });

  it("TC-F02-49 [AC-F02-25] a choice the main process refuses starts nothing", async () => {
    bridge({ chooseShareSource: async () => ({ ok: false }) });
    const r = room();
    expect(await startShare(r, "s1")).toBe(false);
    expect(r.localParticipant.setScreenShareEnabled).not.toHaveBeenCalled();
  });

  it("TC-F02-49 [AC-F02-25] a refused or cancelled screen request is not a share; stopping never throws", async () => {
    bridge(undefined);
    const r = room();
    r.localParticipant.setScreenShareEnabled.mockRejectedValue(new Error("cancelled"));
    expect(await startShare(r, undefined)).toBe(false);
    await expect(stopShare(r)).resolves.toBeUndefined();
    r.localParticipant.setScreenShareEnabled.mockResolvedValue({});
    expect(await startShare(r, undefined)).toBe(true);
  });
});
