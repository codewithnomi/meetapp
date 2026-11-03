// The mini window's live video from the main window (TC-F16-33): pictures are sent only while the mini
// window wants them, and stop when it hides.
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FRAME_EVERY_MS, cover, useFrameSender } from "./frames.ts";

let wanted: (on: boolean) => void = () => undefined;
const sendFrame = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  sendFrame.mockReset();
  (window as { meetapp?: unknown }).meetapp = {
    callWindows: {
      onFramesWanted: (listener: (on: boolean) => void) => {
        wanted = listener;
        listener(false);
        return () => undefined;
      },
      sendFrame,
    },
  };
  vi.stubGlobal("MediaStream", vi.fn());
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 640 });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 480 });
  HTMLVideoElement.prototype.play = () => Promise.resolve();
  HTMLCanvasElement.prototype.getContext = (() => ({ drawImage: vi.fn() })) as never;
  HTMLCanvasElement.prototype.toBlob = function (done: BlobCallback) {
    done(new Blob([new Uint8Array(4)], { type: "image/jpeg" }));
  };
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (window as { meetapp?: unknown }).meetapp;
});

describe("TC-F16-33 [AC-F16-15] live video for the mini window", () => {
  it("TC-F16-33 [AC-F16-15] sends pictures only while wanted", async () => {
    renderHook(() => useFrameSender({} as MediaStreamTrack));
    await act(() => vi.advanceTimersByTimeAsync(FRAME_EVERY_MS * 3));
    expect(sendFrame).not.toHaveBeenCalled();
    act(() => wanted(true));
    await act(() => vi.advanceTimersByTimeAsync(FRAME_EVERY_MS * 3));
    expect(sendFrame.mock.calls.length).toBeGreaterThan(0);
    act(() => wanted(false));
    const sent = sendFrame.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(FRAME_EVERY_MS * 5));
    expect(sendFrame.mock.calls.length).toBe(sent);
  });

  it("TC-F16-33 [AC-F16-15] no video (camera off): nothing is sent", async () => {
    renderHook(() => useFrameSender(undefined));
    act(() => wanted(true));
    await act(() => vi.advanceTimersByTimeAsync(FRAME_EVERY_MS * 3));
    expect(sendFrame).not.toHaveBeenCalled();
  });

  it("a 4:3 camera is cropped at the top and bottom to fill 16:9", () => {
    expect(cover(640, 480)).toEqual({ sx: 0, sy: 60, sw: 640, sh: 360 });
  });
});
