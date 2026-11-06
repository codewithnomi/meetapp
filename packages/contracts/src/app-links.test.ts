import { describe, expect, it } from "vitest";
import { appMeetingLink, asAppMeetingLink, isMeetingCode, readAppMeetingLink } from "./app-links.ts";

const CODE = "AbCdEfGhIjKlMnOpQrSt_-";

describe("meeting links for the desktop app (F04 T6)", () => {
  it("TC-F04-24 [AC-F04-10] reads an exact link, any scheme case, one trailing slash", () => {
    expect(readAppMeetingLink(`meetapp://m/${CODE}`)).toBe(CODE);
    expect(readAppMeetingLink(`MeetApp://m/${CODE}/`)).toBe(CODE);
  });

  it("TC-F04-24 TC-F04-31 [AC-F04-11] everything else is ignored and nothing throws", () => {
    const bad: unknown[] = [
      `meetapp://m/${CODE.slice(1)}`,
      `meetapp://m/${CODE}x`,
      `meetapp://m/${CODE}/x`,
      `meetapp://m/${CODE}?join=1`,
      `meetapp://m/${CODE}#x`,
      `meetapp://u@m/${CODE}`,
      `meetapp://m:80/${CODE}`,
      `meetapp://x/${CODE}`,
      "meetapp://m/",
      "meetapp://settings",
      `meetapp://m/${CODE}/../admin`,
      `meetapp://m/%2F${CODE.slice(3)}`,
      `https://meet.example/m/${CODE}`,
      "javascript:alert(1)",
      `meetapp://m/${CODE}\n`,
      `meetapp://m/${"a".repeat(10_000)}`,
      `meetapp://m/${CODE}//`,
      42,
      undefined,
    ];
    for (const input of bad) expect(readAppMeetingLink(input), String(input)).toBeUndefined();
  });

  it("TC-F04-33 [AC-F04-12] the copied link is meetapp://m/<code> with the shared link's code", () => {
    expect(appMeetingLink(CODE)).toBe(`meetapp://m/${CODE}`);
    expect(asAppMeetingLink(`http://127.0.0.1:5173/m/${CODE}`)).toBe(`meetapp://m/${CODE}`);
    expect(asAppMeetingLink("not a link")).toBe("not a link");
    expect(isMeetingCode(CODE)).toBe(true);
    expect(isMeetingCode(`${CODE}/`)).toBe(false);
  });
});
