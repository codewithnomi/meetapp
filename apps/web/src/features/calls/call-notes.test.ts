// Call note words (F15 TC-F15-34; AC-F15-15): lengths and the three notes, from the translation file.
import i18n from "i18next";
import { describe, expect, it } from "vitest";
import { callNoteText, durationText } from "./call-notes.ts";

const t = i18n.t.bind(i18n);

describe("call notes", () => {
  it("TC-F15-34 [AC-F15-15] lengths read as seconds, minutes and seconds, or hours and minutes", () => {
    expect([0, 59, 750, 3599, 3900, 36000].map((s) => durationText(t, s))).toEqual([
      "0s",
      "59s",
      "12m 30s",
      "59m 59s",
      "1h 05m",
      "10h 00m",
    ]);
  });

  it("TC-F15-34 [AC-F15-15] started, ended and missed notes; other notes have no call words", () => {
    expect(callNoteText(t, { event: "call_started", name: "Sara Malik" })).toBe("Sara Malik started a call");
    expect(callNoteText(t, { event: "call_ended", name: "Sara Malik", seconds: 750 })).toBe("Call ended · 12m 30s");
    expect(callNoteText(t, { event: "call_missed", name: "Omar Farooq" })).toBe("Missed call from Omar Farooq");
    expect(callNoteText(t, { event: "pinned", name: "Sara Malik" })).toBeUndefined();
  });
});
