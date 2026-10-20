// Notes and names in the meeting chat (F03 TC-F03-66): each chat setting change is named in words,
// and "You" is shown only for the viewer's own messages during a call.
import type { ChatMessageView } from "@meetapp/contracts";
import i18n from "i18next";
import { describe, expect, it } from "vitest";
import { continuesGroup, noteText, senderName } from "./chat-texts.ts";

const note = (mode: "on" | "off" | "in_meeting") =>
  ({ kind: "system", system: { event: "chat_mode", name: "Aisha Khan", mode } }) as ChatMessageView;

describe("chat texts", () => {
  it("TC-F03-66 [AC-F03-37] each chat setting change is named", () => {
    expect(noteText(i18n.t, note("off"))).toBe("Aisha Khan turned chat off");
    expect(noteText(i18n.t, note("on"))).toBe("Aisha Khan turned chat on");
    expect(noteText(i18n.t, note("in_meeting"))).toBe("Aisha Khan limited chat to the meeting");
  });

  it("[AC-F03-42] after the meeting nobody is shown as You", () => {
    const message = { sender: { attendanceId: "a1", name: "Bilal", group: "member" } } as ChatMessageView;
    expect(senderName(i18n.t, message, "a1")).toBe("You");
    expect(senderName(i18n.t, message, undefined)).toBe("Bilal");
  });
});

const said = (who: string, at: string, kind = "text") =>
  ({ kind, sender: { attendanceId: who }, createdAt: at }) as ChatMessageView;

describe("grouping", () => {
  it("TC-F03-95 [AC-F03-48] the same person in the same minute continues the group; anything else starts one", () => {
    const first = said("a", "2026-10-20T10:41:05.000Z");
    expect(continuesGroup(undefined, first)).toBe(false);
    expect(continuesGroup(first, said("a", "2026-10-20T10:41:50.000Z"))).toBe(true);
    expect(continuesGroup(first, said("a", "2026-10-20T10:42:01.000Z"))).toBe(false);
    expect(continuesGroup(first, said("b", "2026-10-20T10:41:20.000Z"))).toBe(false);
    expect(continuesGroup(said("a", "2026-10-20T10:41:10.000Z", "system"), said("a", "2026-10-20T10:41:20.000Z"))).toBe(
      false,
    );
  });
});
