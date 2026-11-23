// The form's words for a refusal (TC-F13-31, AC-F13-14): each limit says how long to wait.
import { describe, expect, it } from "vitest";
import { ApiError } from "../api/index.ts";
import { refusalText } from "./schedule-api.ts";

describe("refusalText", () => {
  it("TC-F13-31 [AC-F13-14] too many meetings and too many emails each say how long to wait", () => {
    expect(refusalText(new ApiError("TOO_MANY_ATTEMPTS", 429, 720))).toEqual({
      key: "schedule.errors.tooManyMeetings",
      minutes: 12,
    });
    expect(refusalText(new ApiError("TOO_MANY_EMAILS", 429, 30))).toEqual({
      key: "schedule.errors.tooManyEmails",
      minutes: 1,
    });
    expect(refusalText(new ApiError("NETWORK_ERROR", 0))).toEqual({ key: "schedule.errors.offline" });
  });
});
