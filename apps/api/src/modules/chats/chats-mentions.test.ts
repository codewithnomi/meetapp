// The mention and "Seen" rules (F14 AC-F14-22, 24).
import { randomUUID } from "node:crypto";
import type { MessageDocument } from "@meetapp/contracts";
import { describe, expect, it } from "vitest";
import { cleanMentions, seenApplies } from "./chats-mentions.ts";

const member = randomUUID();
const outsider = randomUUID();
const mention = (userId: string, text: string) => ({ type: "mention" as const, userId, text });

describe("mentions", () => {
  it("TC-F14-45 [AC-F14-22] keeps members' mentions, turns anyone else's into plain text, inside lists too", () => {
    const document: MessageDocument = {
      v: 1,
      blocks: [
        {
          type: "paragraph",
          content: [mention(member, "@Maya"), { type: "text", text: " hi " }, mention(outsider, "@Eli")],
        },
        { type: "bulletList", items: [{ content: [{ type: "paragraph", content: [mention(outsider, "@Eli")] }] }] },
      ],
    };
    const { document: cleaned, mentioned } = cleanMentions(document, new Set([member]));
    expect(mentioned).toEqual([member]);
    expect(cleaned.blocks[0]).toEqual({
      type: "paragraph",
      content: [mention(member, "@Maya"), { type: "text", text: " hi " }, { type: "text", text: "@Eli" }],
    });
    expect(JSON.stringify(cleaned.blocks[1])).not.toContain(outsider);
  });
});

describe("Seen", () => {
  const on = { readerOn: true, senderOn: true };
  it("TC-F14-48 [AC-F14-24] one-to-one and groups up to 20 with receipts on both sides", () => {
    expect(seenApplies({ kind: "direct", members: 2, ...on })).toBe(true);
    expect(seenApplies({ kind: "group", members: 20, ...on })).toBe(true);
    expect(seenApplies({ kind: "group", members: 21, ...on })).toBe(false);
    expect(seenApplies({ kind: "group", members: 250, ...on })).toBe(false);
    expect(seenApplies({ kind: "direct", members: 2, readerOn: false, senderOn: true })).toBe(false);
    expect(seenApplies({ kind: "direct", members: 2, readerOn: true, senderOn: false })).toBe(false);
  });
});
