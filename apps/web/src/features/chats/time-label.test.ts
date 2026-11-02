// The chat list's time label (TC-F14-02, AC-F14-01).
import { describe, expect, it } from "vitest";
import { timeLabel } from "./time-label.ts";

const NOW = new Date(2026, 9, 22, 15, 30); // Thursday 22 October 2026

describe("timeLabel", () => {
  it("TC-F14-02 [AC-F14-01] today the time, this week the weekday, older the date", () => {
    expect(timeLabel(new Date(2026, 9, 22, 9, 5), NOW, "en-GB")).toBe("09:05");
    expect(timeLabel(new Date(2026, 9, 19, 9, 5), NOW, "en-GB")).toBe("Mon");
    expect(timeLabel(new Date(2026, 9, 12, 9, 5), NOW, "en-GB")).toBe("12 Oct");
    expect(timeLabel(new Date(2025, 9, 12, 9, 5), NOW, "en-GB")).toBe("12 Oct 2025");
  });

  it("TC-F14-02 [AC-F14-01] the language decides the words", () => {
    expect(timeLabel(new Date(2026, 9, 19, 9, 5), NOW, "fr-FR")).toBe("lun.");
  });
});
