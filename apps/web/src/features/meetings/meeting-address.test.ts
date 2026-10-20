// Join input clean-up (AC-F02-08): spaces in the ID, a trimmed link and passcode, and the spaced ID.
import { describe, expect, it } from "vitest";
import { idAddress, linkAddress, spacedMeetingNumber } from "./meeting-address.ts";

describe("meeting address", () => {
  it("TC-F02-18 [AC-F02-08] the ID loses its spaces and dashes; link and passcode are trimmed", () => {
    expect(idAddress(" 284 615-903 172 ", " h3Tq9z ")).toEqual({ meetingNumber: "284615903172", passcode: "h3Tq9z" });
    expect(linkAddress("  https://meetapp.app/m/abc \n")).toEqual({ link: "https://meetapp.app/m/abc" });
  });

  it("TC-F02-13 [AC-F02-01] the ID is shown in groups of three", () => {
    expect(spacedMeetingNumber("284615903172")).toBe("284 615 903 172");
  });
});
