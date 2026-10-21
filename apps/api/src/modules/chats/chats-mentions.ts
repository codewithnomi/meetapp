// @mentions and "Seen" (F14 AC-F14-22, 24), as in Teams: a mention of someone who isn't in the chat is
// sent as plain text; "Seen" shows in one-to-one chats and groups of up to 20 when both the reader and
// the sender have read receipts on.
import { CHATS_LIMITS, type Block, type MessageDocument } from "@meetapp/contracts";

type Paragraph = Extract<Block, { type: "paragraph" }>;
type Inline = NonNullable<Paragraph["content"]>[number];
type ListBlock = Extract<Block, { type: "bulletList" | "orderedList" }>;

function cleanInline(parts: Inline[], members: ReadonlySet<string>, found: Set<string>): Inline[] {
  return parts.map((part) => {
    if (part.type !== "mention") return part;
    if (members.has(part.userId)) {
      found.add(part.userId);
      return part;
    }
    return { type: "text", text: part.text };
  });
}

function cleanParagraph(paragraph: Paragraph, members: ReadonlySet<string>, found: Set<string>): Paragraph {
  return paragraph.content ? { ...paragraph, content: cleanInline(paragraph.content, members, found) } : paragraph;
}

function cleanList(list: ListBlock, members: ReadonlySet<string>, found: Set<string>): ListBlock {
  return {
    ...list,
    items: list.items.map((item) => ({
      content: item.content.map((part) =>
        part.type === "paragraph" ? cleanParagraph(part, members, found) : cleanList(part, members, found),
      ),
    })),
  };
}

/** Keeps mentions of chat members only; returns the cleaned message and who is mentioned. */
export function cleanMentions(document: MessageDocument, members: ReadonlySet<string>) {
  const found = new Set<string>();
  const blocks = document.blocks.map((block): Block => {
    if (block.type === "paragraph") return cleanParagraph(block, members, found);
    if (block.type === "quote")
      return { ...block, content: block.content.map((p) => cleanParagraph(p, members, found)) };
    if (block.type === "codeBlock") return block;
    return cleanList(block, members, found);
  });
  return { document: { ...document, blocks }, mentioned: [...found] };
}

/** Whether "Seen" applies: one-to-one chats and groups of up to 20, both people with receipts on. */
export function seenApplies(facts: {
  kind: "direct" | "group";
  members: number;
  readerOn: boolean;
  senderOn: boolean;
}) {
  if (!facts.readerOn || !facts.senderOn) return false;
  return facts.kind === "direct" || facts.members <= CHATS_LIMITS.seenGroupMax;
}
