import { describe, expect, it } from "vitest";
import { APP_LINK_SCHEME } from "@meetapp/contracts";
import { appIdentity } from "../../app-identity.ts";
import { linkInArgs } from "./links.ts";

describe("meeting links in the desktop app (F04 T6)", () => {
  it("TC-F04-26 [AC-F04-10] finds the link among a start's arguments (Windows)", () => {
    expect(linkInArgs(["MeetApp.exe", "--hidden", "meetapp://m/abc"])).toBe("meetapp://m/abc");
    expect(linkInArgs(["MeetApp.exe", "MEETAPP://m/abc"])).toBe("MEETAPP://m/abc");
    expect(linkInArgs(["MeetApp.exe", "--flag=meetapp://x"])).toBeUndefined();
  });

  it("TC-F04-33 [AC-F04-12] the link scheme is the app identity's (D087)", () => {
    expect(appIdentity.linkScheme).toBe(APP_LINK_SCHEME);
  });
});
