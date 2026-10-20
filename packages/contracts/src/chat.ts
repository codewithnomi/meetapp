// In-meeting chat (F03 design.md sections 3–8). The message document is the only shape a message
// body may have (design 5.2): a short list of blocks with a few allowed marks, never HTML. Anything
// else is refused, so nothing a person types or pastes can become page code.
import { z } from "zod";

export const CHAT_MODES = ["on", "in_meeting", "off"] as const;
export type ChatMode = (typeof CHAT_MODES)[number];

/** Visible characters a message may have, code included (AC-F03-03). */
export const MAX_MESSAGE_CHARS = 4000;
/** Stored size of one message document, in bytes (design 5.2). */
export const MAX_DOCUMENT_BYTES = 32 * 1024;
export const MAX_LINK_LENGTH = 2000;
/** Lists inside lists: at most 3 levels deep. */
export const MAX_LIST_DEPTH = 3;

/** Only web links: http and https (AC-F03-04). */
const linkHref = z
  .string()
  .max(MAX_LINK_LENGTH)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "only http and https links");

const markSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("bold") }),
  z.strictObject({ type: z.literal("italic") }),
  z.strictObject({ type: z.literal("underline") }),
  z.strictObject({ type: z.literal("strike") }),
  z.strictObject({ type: z.literal("code") }),
  z.strictObject({ type: z.literal("link"), href: linkHref }),
]);

const inlineSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("text"), text: z.string().min(1), marks: z.array(markSchema).max(6).optional() }),
  z.strictObject({ type: z.literal("hardBreak") }),
]);

const paragraphSchema = z.strictObject({ type: z.literal("paragraph"), content: z.array(inlineSchema).optional() });
type Paragraph = z.infer<typeof paragraphSchema>;

export type ListItem = { content: (Paragraph | List)[] };
export type List = { type: "bulletList" | "orderedList"; items: ListItem[] };

const listSchema: z.ZodType<List> = z.lazy(() =>
  z.strictObject({
    type: z.enum(["bulletList", "orderedList"]),
    items: z.array(z.strictObject({ content: z.array(z.union([paragraphSchema, listSchema])).min(1) })).min(1),
  }),
);

const blockSchema = z.union([
  paragraphSchema,
  listSchema,
  z.strictObject({ type: z.literal("quote"), content: z.array(paragraphSchema).min(1) }),
  z.strictObject({
    type: z.literal("codeBlock"),
    language: z
      .string()
      .max(30)
      .regex(/^[a-z0-9+#-]*$/)
      .optional(),
    text: z.string(),
  }),
]);
export type Block = z.infer<typeof blockSchema>;

function listDepth(list: List): number {
  let deepest = 0;
  for (const item of list.items) {
    for (const part of item.content) {
      if (part.type !== "paragraph") deepest = Math.max(deepest, listDepth(part));
    }
  }
  return deepest + 1;
}

function paragraphText(paragraph: Paragraph): string {
  return (paragraph.content ?? []).map((part) => (part.type === "text" ? part.text : "\n")).join("");
}

function listText(list: List): string[] {
  return list.items.flatMap((item) =>
    item.content.flatMap((part) => (part.type === "paragraph" ? [paragraphText(part)] : listText(part))),
  );
}

/** The visible text of a document: counted for the limit, used for Copy text and later search. */
export function documentPlainText(document: MessageDocument): string {
  return document.blocks
    .flatMap((block) => {
      if (block.type === "paragraph") return [paragraphText(block)];
      if (block.type === "codeBlock") return [block.text];
      if (block.type === "quote") return block.content.map(paragraphText);
      return listText(block);
    })
    .join("\n");
}

export const messageDocumentSchema = z
  .strictObject({ v: z.literal(1), blocks: z.array(blockSchema).min(1).max(200) })
  .superRefine((document, context) => {
    if (new TextEncoder().encode(JSON.stringify(document)).length > MAX_DOCUMENT_BYTES) {
      context.addIssue({ code: "custom", message: "the message is too large" });
    }
    for (const block of document.blocks) {
      if ((block.type === "bulletList" || block.type === "orderedList") && listDepth(block) > MAX_LIST_DEPTH) {
        context.addIssue({ code: "custom", message: "lists are nested too deeply" });
      }
    }
    if ([...documentPlainText(document)].length > MAX_MESSAGE_CHARS) {
      context.addIssue({ code: "custom", message: "the message is too long" });
    }
  })
  .meta({ id: "MessageDocument" });
export type MessageDocument = z.infer<typeof messageDocumentSchema>;
