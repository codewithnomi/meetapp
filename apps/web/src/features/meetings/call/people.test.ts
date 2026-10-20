// Participant order (AC-F02-23): hands first in the order they went up, then you, then by joining.
import { describe, expect, it } from "vitest";
import { inOrder, type CallPerson } from "./people.ts";

const person = (id: string, extra: Partial<CallPerson> = {}): CallPerson => ({
  id,
  name: id,
  isYou: false,
  role: "presenter",
  group: "member",
  userId: undefined,
  handRaisedAt: undefined,
  micOn: true,
  cameraOn: true,
  speaking: false,
  weak: false,
  video: undefined,
  screen: undefined,
  joinedAt: 0,
  ...extra,
});

describe("participant order", () => {
  it("TC-F02-47 [AC-F02-23] hands in the order raised, then you, then by joining time", () => {
    const people = [
      person("late", { joinedAt: 30 }),
      person("hand2", { handRaisedAt: "2026-10-15T10:00:05Z" }),
      person("me", { isYou: true, joinedAt: 20 }),
      person("early", { joinedAt: 10 }),
      person("hand1", { handRaisedAt: "2026-10-15T10:00:01Z" }),
    ];
    expect(inOrder(people).map((p) => p.id)).toEqual(["hand1", "hand2", "me", "early", "late"]);
  });
});
