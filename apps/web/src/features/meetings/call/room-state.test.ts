// The room's shared metadata, written only by the backend (AC-F02-34, 37, 41).
import { describe, expect, it } from "vitest";
import { roomStateOf } from "./room-state.ts";

describe("room state", () => {
  it("TC-F02-69 [AC-F02-37] reads locked, options and the end time", () => {
    const options = { allowAttendeeMic: false, allowAttendeeCamera: true };
    expect(roomStateOf(JSON.stringify({ locked: true, options, endsAt: "2026-10-16T10:00:00Z" }))).toEqual({
      locked: true,
      options,
      endsAt: "2026-10-16T10:00:00Z",
    });
  });

  it("TC-F02-69 [AC-F02-37] nothing, empty or broken metadata means unlocked with nothing set", () => {
    const empty = { locked: false, options: undefined, endsAt: undefined };
    expect(roomStateOf(undefined)).toEqual(empty);
    expect(roomStateOf("{}")).toEqual(empty);
    expect(roomStateOf("not json")).toEqual(empty);
    expect(roomStateOf('{"locked":"yes"}').locked).toBe(false);
  });
});
