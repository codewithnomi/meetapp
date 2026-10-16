// The call connection with a stand-in for the call server (AC-F02-19, 21, 24, 29, 36, T-fix-3).
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS, type DevicePrefs } from "../device-prefs.ts";
import { VISIT } from "../fake-visit.ts";
import type { Joined } from "../visit.ts";
import { useMeetingRoom, type RoomHandlers } from "./meeting-room.ts";
import { encodeReaction } from "./reactions.ts";
import { FakeRoom, fakeParticipant } from "./test-support/fake-room.ts";

vi.mock("livekit-client", async (original) => ({
  ...(await original<typeof import("livekit-client")>()),
  Room: (await import("./test-support/fake-room.ts")).FakeRoom,
}));

const CALL_VISIT: Joined = {
  ...VISIT,
  status: "admitted",
  call: { serverUrl: "wss://call.test", pass: "pass-1", callId: "call-1" },
} as Joined;
const text = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

function handlers(): RoomHandlers {
  return { onReaction: vi.fn(), onControl: vi.fn(), onDisconnected: vi.fn() };
}
function open(prefs: Partial<DevicePrefs> = {}, h = handlers(), visit = CALL_VISIT) {
  const hook = renderHook(() => useMeetingRoom(visit, { ...DEFAULT_PREFS, ...prefs }, h));
  const room = () => FakeRoom.instances.at(-1) as FakeRoom;
  return { ...hook, room, h };
}

beforeEach(() => FakeRoom.reset());
afterEach(() => vi.useRealTimers());

describe("connecting", () => {
  it("TC-F02-30 [AC-F02-19] connects with the pass and turns on the chosen devices and speakers", async () => {
    const { result, room } = open({ speakerId: "spk-1", cameraOn: false });
    await waitFor(() => expect(result.current.connection).toBe("connected"));
    expect(room().connect).toHaveBeenCalledWith("wss://call.test", "pass-1");
    expect(room().switchActiveDevice).toHaveBeenCalledWith("audiooutput", "spk-1");
    expect(room().localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    expect(room().localParticipant.setCameraEnabled).toHaveBeenCalledWith(false);
  });

  it("TC-F02-30 [AC-F02-19] the room is made with the chosen devices and noise suppression", async () => {
    const { result } = open({ cameraId: "cam-1", microphoneId: "mic-1", noiseSuppression: false });
    await waitFor(() => expect(result.current.connection).toBe("connected"));
    const options = FakeRoom.options[0] as {
      audioCaptureDefaults: unknown;
      videoCaptureDefaults: unknown;
      reconnectPolicy: { nextRetryDelayInMs: (c: { elapsedMs: number; retryCount: number }) => number | null };
    };
    expect(options.audioCaptureDefaults).toEqual({
      noiseSuppression: false,
      echoCancellation: true,
      deviceId: "mic-1",
    });
    expect(options.videoCaptureDefaults).toEqual({ deviceId: "cam-1" });
    // Retries for 30 seconds in total, then gives up; waits 1 s, 2 s, 4 s, then 5 s at most.
    const next = options.reconnectPolicy.nextRetryDelayInMs;
    expect([0, 1, 2, 5].map((retryCount) => next({ elapsedMs: 100, retryCount }))).toEqual([1000, 2000, 4000, 5000]);
    expect(next({ elapsedMs: 30_001, retryCount: 1 })).toBeNull();
  });

  it("TC-F02-30 [AC-F02-19] default devices leave the room's capture settings open", async () => {
    const { result } = open();
    await waitFor(() => expect(result.current.connection).toBe("connected"));
    const options = FakeRoom.options[0] as { audioCaptureDefaults: object; videoCaptureDefaults: object };
    expect(options.audioCaptureDefaults).not.toHaveProperty("deviceId");
    expect(options.videoCaptureDefaults).toEqual({});
  });

  it("TC-F02-30 [AC-F02-19] a device that fails to start just stays off", async () => {
    const { result, room } = open();
    room().localParticipant.setMicrophoneEnabled.mockRejectedValue(new Error("refused"));
    room().localParticipant.setCameraEnabled.mockRejectedValue(new Error("refused"));
    room().switchActiveDevice.mockRejectedValue(new Error("no"));
    await waitFor(() => expect(result.current.connection).toBe("connected"));
  });

  it("T-fix-3 a connection closed before connect answers never changes state", async () => {
    let finish: () => void = () => undefined;
    FakeRoom.connectImpl = () => new Promise<void>((resolve) => (finish = resolve));
    const h = handlers();
    const hook = renderHook(() => useMeetingRoom(CALL_VISIT, DEFAULT_PREFS, h));
    const room = FakeRoom.instances[0] as FakeRoom;
    hook.unmount();
    await act(async () => {
      finish();
      await Promise.resolve();
    });
    expect(room.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    expect(room.disconnect).toHaveBeenCalled();
    expect(h.onDisconnected).not.toHaveBeenCalled();
  });

  it("T-fix-3 a connect that is refused after closing never reports a failure", async () => {
    let fail: (e: Error) => void = () => undefined;
    FakeRoom.connectImpl = () => new Promise<void>((_, reject) => (fail = reject));
    const h = handlers();
    const hook = renderHook(() => useMeetingRoom(CALL_VISIT, DEFAULT_PREFS, h));
    hook.unmount();
    await act(async () => {
      fail(new Error("late"));
      await Promise.resolve();
    });
    expect(h.onDisconnected).not.toHaveBeenCalled();
  });

  it("T-fix-3 a connect that is refused sets failed and asks the backend what happened", async () => {
    FakeRoom.connectImpl = () => Promise.reject(new Error("unreachable"));
    const h = handlers();
    const { result } = open({}, h);
    await waitFor(() => expect(result.current.connection).toBe("failed"));
    expect(h.onDisconnected).toHaveBeenCalledWith(undefined);
  });

  it("a visit without a call server address fails instead of connecting", async () => {
    const h = handlers();
    const { result } = open({}, h, VISIT);
    await waitFor(() => expect(result.current.connection).toBe("failed"));
    expect(h.onDisconnected).toHaveBeenCalledWith(undefined);
  });
});

describe("people and events", () => {
  async function connected(h = handlers()) {
    const view = open({}, h);
    await waitFor(() => expect(view.result.current.connection).toBe("connected"));
    return view;
  }

  it("TC-F02-47 [AC-F02-23] the people list updates on events, you first", async () => {
    const { result, room } = await connected();
    expect(result.current.people.map((p) => p.id)).toEqual(["me"]);
    act(() => {
      room().remoteParticipants.set("ann", fakeParticipant("ann", { attributes: { role: "presenter" } }));
      room().emit("participantConnected");
    });
    expect(result.current.people.map((p) => p.id)).toEqual(["me", "ann"]);
    act(() => {
      room().remoteParticipants.delete("ann");
      room().emit("participantDisconnected");
    });
    expect(result.current.people.map((p) => p.id)).toEqual(["me"]);
  });

  it("TC-F02-54 [AC-F02-28] reconnecting and reconnected change the state", async () => {
    const { result, room } = await connected();
    act(() => void room().emit("reconnecting"));
    expect(result.current.connection).toBe("reconnecting");
    act(() => void room().emit("reconnected"));
    expect(result.current.connection).toBe("connected");
  });

  it("TC-F02-29 [AC-F02-29] a disconnect is passed on with its reason", async () => {
    const h = handlers();
    const { room } = await connected(h);
    act(() => void room().emit("disconnected", 3));
    expect(h.onDisconnected).toHaveBeenCalledWith(3);
  });

  it("TC-F02-48 [AC-F02-24] a reaction counts only from a participant, and one a second", async () => {
    const h = handlers();
    const { room } = await connected(h);
    const ann = fakeParticipant("ann");
    const send = (who?: unknown, topic = "meetapp.reaction") =>
      room().emit("dataReceived", encodeReaction("applause"), who, undefined, topic);
    send(ann);
    send(ann);
    send(undefined);
    send(ann, "other");
    expect(h.onReaction).toHaveBeenCalledTimes(1);
    expect(h.onReaction).toHaveBeenCalledWith("ann", "applause");
    room().emit("dataReceived", text({ reaction: "<b>" }), fakeParticipant("bo"), undefined, "meetapp.reaction");
    expect(h.onReaction).toHaveBeenCalledTimes(1);
  });

  it("TC-F02-48 [AC-F02-24] control messages are trusted only without a participant", async () => {
    const h = handlers();
    const { room } = await connected(h);
    const message = text({ type: "muted_by", by: "Ann" });
    room().emit("dataReceived", message, fakeParticipant("evil"), undefined, "meetapp.control");
    expect(h.onControl).not.toHaveBeenCalled();
    room().emit("dataReceived", message, undefined, undefined, "meetapp.control");
    expect(h.onControl).toHaveBeenCalledWith({ type: "muted_by", by: "Ann" });
    room().emit("dataReceived", new TextEncoder().encode("garbage"), undefined, undefined, "meetapp.control");
    expect(h.onControl).toHaveBeenCalledTimes(1);
  });

  it("TC-F02-36 [AC-F02-36] allowed sources and room state come from the server", async () => {
    const { result, room } = await connected();
    expect(result.current.may).toEqual({ microphone: true, camera: true, screen: true });
    room().metadata = JSON.stringify({ locked: true, endsAt: "2026-10-16T10:00:00Z" });
    room().localParticipant.permissions = { canPublishSources: [2] };
    act(() => void room().emit("roomMetadataChanged"));
    expect(result.current.may).toEqual({ microphone: true, camera: false, screen: false });
    expect(result.current.state.locked).toBe(true);
  });

  it("TC-F02-24 [AC-F02-24] actions reach the local participant", async () => {
    const { result, room } = await connected();
    await act(async () => {
      await result.current.setMicrophone(false);
      await result.current.setCamera(true);
      await result.current.sendReaction("applause");
      await result.current.share(undefined);
      await result.current.stopShare();
    });
    const me = room().localParticipant;
    expect(me.setMicrophoneEnabled).toHaveBeenLastCalledWith(false);
    expect(me.setCameraEnabled).toHaveBeenLastCalledWith(true);
    expect(me.publishData).toHaveBeenCalledWith(expect.anything(), { reliable: true, topic: "meetapp.reaction" });
    expect(me.setScreenShareEnabled).toHaveBeenCalledWith(true, { audio: false });
    expect(me.setScreenShareEnabled).toHaveBeenLastCalledWith(false);
  });

  it("TC-F02-30 [AC-F02-19] leaving the screen disconnects and stops listening", async () => {
    const h = handlers();
    const { room, unmount } = await connected(h);
    const r = room();
    unmount();
    expect(r.disconnect).toHaveBeenCalled();
    r.emit("disconnected", 1);
    expect(h.onDisconnected).not.toHaveBeenCalled();
  });
});
