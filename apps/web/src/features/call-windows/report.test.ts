// The report for F16's small windows (TC-F16-15, 17, 32): rings with the busy line, the call as the
// mini window shows it, and missed calls worded for the notification.
import type { RingMessage } from "@meetapp/contracts";
import { describe, expect, it } from "vitest";
import i18n from "i18next";
import { buildReport, callForWindows, initialsOf, missedCall, type CallScreenFacts } from "./report.ts";

const ring = (callId: string, groupName: string | null = null): RingMessage => ({
  t: "ring",
  callId,
  conversationId: "00000000-0000-4000-8000-0000000000c1",
  from: { userId: "00000000-0000-4000-8000-0000000000a1", name: "Sara Malik", photoUrl: null },
  media: "video",
  groupName,
  expiresAt: new Date().toISOString(),
});
const person = (over: Partial<CallScreenFacts["people"][number]> = {}) => ({
  name: "Omar Farooq",
  isYou: false,
  speaking: false,
  micOn: true,
  cameraOn: true,
  handRaisedAt: undefined,
  screen: undefined,
  ...over,
});
const facts = (over: Partial<CallScreenFacts> = {}): CallScreenFacts => ({
  title: "Release team",
  joinedAt: 1_000,
  people: [
    person({ name: "You", isYou: true, cameraOn: false }),
    person(),
    person({ name: "Sara Malik", speaking: true }),
  ],
  connection: "connected",
  may: { microphone: true, screen: true },
  mayShare: true,
  ...over,
});

const t = i18n.t.bind(i18n);

describe("TC-F16-15 TC-F16-17 [AC-F16-07, AC-F16-08] rings in the report", () => {
  it("TC-F16-15 [AC-F16-07] a ring during a meeting says what accepting leaves; without one it doesn't", () => {
    expect(buildReport([ring("c1")], "Release team", null, []).rings[0]?.busyIn).toBe("Release team");
    expect(buildReport([ring("c1")], undefined, null, []).rings[0]).not.toHaveProperty("busyIn");
  });

  it("TC-F16-17 [AC-F16-08] two rings are two entries, with the group's name and initials", () => {
    const report = buildReport([ring("c2", "Design"), ring("c1")], undefined, null, []);
    expect(report.rings.map((r) => r.callId)).toEqual(["c2", "c1"]);
    expect(report.rings[0]).toMatchObject({ chatName: "Design", caller: { name: "Sara Malik", initials: "SM" } });
    expect(report.rings[1]).not.toHaveProperty("chatName");
    expect(initialsOf("  ali ")).toBe("A");
  });
});

describe("TC-F16-32 [AC-F16-15, AC-F16-18] the call in the report", () => {
  it("TC-F16-32 [AC-F16-15] the speaker is whoever speaks; your own mic, camera and hand", () => {
    const call = callForWindows(facts());
    expect(call).toMatchObject({
      title: "Release team",
      joinedAt: 1_000,
      people: 3,
      phase: "in-call",
      speaker: { name: "Sara Malik", initials: "SM", hasVideo: true, sharing: false },
      mic: true,
      camera: false,
      hand: false,
      canUnmute: true,
      canShare: true,
    });
  });

  it("TC-F16-32 [AC-F16-15] whoever shares comes first; with nobody speaking someone else is shown", () => {
    const sharing = facts({ people: [person({ name: "You", isYou: true }), person({ name: "Bilal", screen: {} })] });
    expect(callForWindows(sharing).speaker).toMatchObject({ name: "Bilal", sharing: true });
    const quiet = facts({ people: [person({ name: "You", isYou: true }), person({ name: "Bilal", cameraOn: false })] });
    expect(callForWindows(quiet).speaker).toMatchObject({ name: "Bilal", hasVideo: false });
    const alone = facts({ people: [person({ name: "You", isYou: true })] });
    expect(callForWindows(alone).speaker.name).toBe("You");
  });

  it("TC-F16-32 [AC-F16-16, AC-F16-18] reconnecting, a locked microphone and no right to share", () => {
    expect(callForWindows(facts({ connection: "reconnecting" })).phase).toBe("reconnecting");
    const locked = callForWindows(facts({ may: { microphone: false, screen: true }, mayShare: false }));
    expect(locked).toMatchObject({ canUnmute: false, canShare: false });
  });

  it("TC-F16-32 [AC-F16-14] no call gives call: null", () => {
    expect(buildReport([], undefined, null, []).call).toBeNull();
  });
});

describe("TC-F16-20 [AC-F16-10, AC-F16-23] a missed call for the notification", () => {
  it("TC-F16-20 [AC-F16-10, AC-F16-23] names only, translated, with the chat to open", () => {
    const one = missedCall(ring("c1"), 5, t);
    expect(one).toMatchObject({ callId: "c1", from: "Sara Malik", kind: "video", endedAt: 5 });
    expect(one.text).toEqual({ title: "Missed call", body: "from Sara Malik", callBack: "Call back" });
    expect(missedCall(ring("c2", "Release team"), 5, t).text.body).toBe("from Sara Malik in Release team");
  });
});
