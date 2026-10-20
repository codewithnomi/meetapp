// The call-server provider without a call server (F02 T-fix-5): what it asks LiveKit to do for muting,
// server messages, removal, rights and the room list (AC-F02-33, 34, 49). The real server is used in
// livekit-rooms.integration.test.ts and livekit-passes.integration.test.ts.
import { DataPacket_Kind, TrackSource, type ParticipantInfo } from "livekit-server-sdk";
import { describe, expect, it, vi } from "vitest";
import { fakeConfig } from "../test-support/fake-env.ts";
import { createLiveKitProvider } from "./livekit.ts";

function provider() {
  const livekit = createLiveKitProvider(fakeConfig());
  const mute = vi.spyOn(livekit.rooms, "mutePublishedTrack").mockResolvedValue({} as never);
  const send = vi.spyOn(livekit.rooms, "sendData").mockResolvedValue();
  const update = vi.spyOn(livekit.rooms, "updateParticipant").mockResolvedValue({} as never);
  const remove = vi.spyOn(livekit.rooms, "removeParticipant").mockResolvedValue();
  return { livekit, mute, send, update, remove };
}

const withTracks = (tracks: { sid: string; source: TrackSource; muted: boolean }[]) =>
  ({ identity: "a1", tracks }) as unknown as ParticipantInfo;

describe("muting a microphone", () => {
  it("TC-F02-67 [AC-F02-33] mutes the person's live microphone track", async () => {
    const { livekit, mute } = provider();
    vi.spyOn(livekit.rooms, "getParticipant").mockResolvedValue(
      withTracks([
        { sid: "cam", source: TrackSource.CAMERA, muted: false },
        { sid: "mic", source: TrackSource.MICROPHONE, muted: false },
      ]),
    );
    expect(await livekit.muteMicrophone("room", "a1")).toBe(true);
    expect(mute).toHaveBeenCalledWith("room", "a1", "mic", true);
  });

  it("TC-F02-67 [AC-F02-33] does nothing when the microphone is off or already muted", async () => {
    const { livekit, mute } = provider();
    vi.spyOn(livekit.rooms, "getParticipant")
      .mockResolvedValueOnce(withTracks([]))
      .mockResolvedValueOnce(withTracks([{ sid: "mic", source: TrackSource.MICROPHONE, muted: true }]));
    expect(await livekit.muteMicrophone("room", "a1")).toBe(false);
    expect(await livekit.muteMicrophone("room", "a1")).toBe(false);
    expect(mute).not.toHaveBeenCalled();
  });
});

describe("server messages", () => {
  it("TC-F02-70 [AC-F02-34] go to everyone, or only to the listed people, on the trusted topic", async () => {
    const { livekit, send } = provider();
    await livekit.sendControl("room", { type: "lobby_changed" });
    await livekit.sendControl("room", { type: "muted_by", by: "Aisha" }, ["a1"]);
    const [everyone, one] = send.mock.calls;
    expect(everyone?.[3]).toEqual({ topic: "meetapp.control" });
    expect(one?.[3]).toEqual({ topic: "meetapp.control", destinationIdentities: ["a1"] });
    expect(one?.[2]).toBe(DataPacket_Kind.RELIABLE);
    expect(JSON.parse(new TextDecoder().decode(one?.[1]))).toEqual({ type: "muted_by", by: "Aisha" });
  });
});

describe("rights, removal and rooms", () => {
  it("TC-F02-70 [AC-F02-34] [AC-F02-36] someone with no sources may publish nothing; metadata is never theirs", async () => {
    const { livekit, update } = provider();
    await livekit.setRights("room", "a1", []);
    await livekit.setRights("room", "a2", ["microphone", "screen_share"]);
    const [none, some] = update.mock.calls.map(
      (call) => (call[2] as unknown as { permission: Record<string, unknown> }).permission,
    );
    expect(none).toMatchObject({ canPublish: false, canPublishSources: [], canUpdateMetadata: false });
    expect(some).toMatchObject({
      canPublish: true,
      canPublishSources: [TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE],
    });
  });

  it("TC-F02-98 [AC-F02-49] removal also stops passes issued before now", async () => {
    const { livekit, remove } = provider();
    const before = BigInt(Math.floor(Date.now() / 1000));
    await livekit.remove("room", "a1");
    const options = remove.mock.calls[0]?.[2] as { revokeTokenTs: bigint };
    expect(options.revokeTokenTs >= before).toBe(true);
  });

  it("TC-F02-99 [AC-F02-49] lists the running rooms by name", async () => {
    const { livekit } = provider();
    vi.spyOn(livekit.rooms, "listRooms").mockResolvedValue([{ name: "r1" }, { name: "r2" }] as never);
    expect(await livekit.runningRooms()).toEqual(["r1", "r2"]);
  });
});
