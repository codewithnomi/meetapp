// A person as the screens need them, read from the call (AC-F02-21, 23, 28, 36).
import { describe, expect, it, vi } from "vitest";
import { inOrder, personOf, type CallPerson } from "./people.ts";
import { fakeParticipant } from "./test-support/fake-room.ts";

const read = (extra: Parameters<typeof fakeParticipant>[1]) =>
  personOf(fakeParticipant("p1", extra) as unknown as Parameters<typeof personOf>[0]);

describe("person from the call", () => {
  it("TC-F02-47 [AC-F02-23] reads name, role, group, user and hand from the server's attributes", () => {
    const person = read({
      name: "Ann",
      attributes: { role: "co_organizer", group: "external", userId: "u1", handRaisedAt: "2026-10-16T10:00:00Z" },
      isSpeaking: true,
      isCameraEnabled: true,
      joinedAt: new Date(5),
    });
    expect(person).toMatchObject({
      id: "p1",
      name: "Ann",
      role: "co_organizer",
      group: "external",
      userId: "u1",
      handRaisedAt: "2026-10-16T10:00:00Z",
      speaking: true,
      cameraOn: true,
      joinedAt: 5,
    });
  });

  it("TC-F02-67 [AC-F02-36] unknown or missing roles and groups fall back to the least rights", () => {
    expect(read({ attributes: { role: "admin", group: "vip" } })).toMatchObject({ role: "attendee", group: "guest" });
    expect(read({ attributes: {} })).toMatchObject({ role: "attendee", group: "guest" });
  });

  it("TC-F02-47 [AC-F02-23] empty user and hand attributes mean none; a missing name and join time are empty", () => {
    const person = read({
      attributes: { userId: "", handRaisedAt: "" },
      name: undefined as never,
      joinedAt: undefined,
    });
    expect(person).toMatchObject({ userId: undefined, handRaisedAt: undefined, name: "", joinedAt: 0 });
  });

  it("TC-F02-54 [AC-F02-28] poor or lost quality shows as a weak line; good does not", () => {
    expect(read({ connectionQuality: "poor" }).weak).toBe(true);
    expect(read({ connectionQuality: "lost" }).weak).toBe(true);
    expect(read({ connectionQuality: "good" }).weak).toBe(false);
  });

  it("TC-F02-30 [AC-F02-19] a muted camera or screen has no video; a live one does", () => {
    const videoTrack = { id: "v" };
    const live = { isMuted: false, videoTrack };
    const bySource = (camera: unknown, screen: unknown) =>
      vi.fn((source: string) => (source === "camera" ? camera : source === "screen_share" ? screen : undefined));
    expect(read({ getTrackPublication: bySource(live, live) })).toMatchObject({
      video: videoTrack,
      screen: videoTrack,
    });
    const muted = { isMuted: true, videoTrack };
    expect(read({ getTrackPublication: bySource(muted, muted) })).toMatchObject({
      video: undefined,
      screen: undefined,
    });
    expect(read({ getTrackPublication: bySource({ isMuted: false, videoTrack: null }, undefined) }).video).toBe(
      undefined,
    );
  });

  it("TC-F02-47 [AC-F02-23] ordering keeps the sort stable when nothing differs and leaves the input alone", () => {
    const a = read({ joinedAt: new Date(1) }) as CallPerson;
    const input = [{ ...a, id: "b", joinedAt: 2 }, a];
    expect(inOrder(input).map((p) => p.id)).toEqual(["p1", "b"]);
    expect(input.map((p) => p.id)).toEqual(["b", "p1"]);
  });
});
