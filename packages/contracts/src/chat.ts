// In-meeting chat (F03 design.md sections 3–8). The message document is the only shape a message
// body may have (design 5.2): a short list of blocks with a few allowed marks, never HTML. Anything
// else is refused, so nothing a person types or pastes can become page code.
import { z } from "zod";

export const CHAT_MODES = ["on", "in_meeting", "off"] as const;
export type ChatMode = (typeof CHAT_MODES)[number];

/** MeetApp's own sticker set (AC-F03-26): names only; the pictures are built into the app. */
export const STICKERS = [
  "thank-you",
  "great-job",
  "on-my-way",
  "be-right-back",
  "agreed",
  "coffee",
  "ship-it",
  "welcome",
  "congrats",
  "good-morning",
  "good-night",
  "sorry",
  "thinking",
  "lol",
  "wow",
  "yes",
  "no",
  "brb-coffee",
  "lunch",
  "deadline",
  "celebrate",
  "high-five",
  "question",
  "done",
] as const;
export type StickerName = (typeof STICKERS)[number];

/** GIF images may come only from KLIPY's image host (D059, design section 7). */
export const GIF_IMAGE_ORIGIN = "https://static.klipy.com";
const gifAddress = z
  .string()
  .max(2000)
  .refine((value) => value.startsWith(`${GIF_IMAGE_ORIGIN}/`), "GIFs come from the GIF service only");

/** A GIF as KLIPY returned it: its id, a description for screen readers and its addresses, unchanged. */
export const gifSchema = z.strictObject({
  id: z.string().min(1).max(100),
  description: z.string().max(200),
  url: gifAddress,
  stillUrl: gifAddress.optional(),
  width: z.number().int().positive().max(4000),
  height: z.number().int().positive().max(4000),
});

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

type ListItem = { content: (Paragraph | List)[] };
type List = { type: "bulletList" | "orderedList"; items: ListItem[] };

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

/** How many visible characters a document has over the limit; 0 when it fits (AC-F03-03). */
export function charactersOverLimit(document: MessageDocument): number {
  return Math.max(0, [...documentPlainText(document)].length - MAX_MESSAGE_CHARS);
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

/** How many messages one page of history holds (AC-F03-02). */
export const CHAT_PAGE_SIZE = 50;

export const chatParamsSchema = z.object({ callId: z.string() });
export const chatMessageParamsSchema = z.object({ callId: z.string(), messageId: z.string() });

/** Sending a text message; `clientId` makes a repeated send return the saved message (AC-F03-05). */
export const sendMessageBodySchema = z
  .object({
    clientId: z.uuid(),
    /** May be left out when the message only carries files. */
    body: messageDocumentSchema.optional(),
    replyToId: z.uuid().optional(),
    gif: gifSchema.optional(),
    sticker: z.enum(STICKERS).optional(),
    /** Files uploaded first (up to 10 per message, AC-F03-28). */
    attachmentIds: z.array(z.uuid()).max(10).optional(),
  })
  .meta({ id: "SendChatMessage" });

/** Older messages: `before` is the cursor of the oldest message already shown. */
export const messagesQuerySchema = z.object({
  before: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(CHAT_PAGE_SIZE).default(CHAT_PAGE_SIZE),
});

export const eventsQuerySchema = z.object({ after: z.coerce.number().int().min(0).default(0) });

export const chatMessageSchema = z
  .object({
    id: z.uuid(),
    /** Pass as `before` to get the messages older than this one. */
    cursor: z.string(),
    /** The id the sender's app made, so it can swap its "sending" copy for this one. */
    clientId: z.string(),
    /** The call it was sent in: only messages of the running call can be edited by their sender. */
    callId: z.string().nullable(),
    kind: z.enum(["text", "gif", "sticker", "poll", "system"]),
    sender: z.object({
      attendanceId: z.uuid().nullable(),
      name: z.string(),
      group: z.enum(["member", "external", "guest"]),
      userId: z.uuid().nullable(),
    }),
    body: messageDocumentSchema.nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    editedAt: z.iso.datetime({ offset: true }).nullable(),
    deletedAt: z.iso.datetime({ offset: true }).nullable(),
    /** The quoted message (AC-F03-14): its sender and first line, built when read, so edits show. */
    replyTo: z.object({ id: z.uuid(), senderName: z.string(), firstLine: z.string(), deleted: z.boolean() }).nullable(),
    /** Emoji with their counts, the names of who reacted, and whether "you" did (AC-F03-13). */
    reactions: z.array(
      z.object({
        emoji: z.string(),
        count: z.number().int(),
        names: z.array(z.string()),
        /** Who reacted (their joins), so each app works out "mine" itself from news sent to everyone. */
        attendanceIds: z.array(z.string()),
        /** For the person who asked; false in news sent to the whole room. */
        mine: z.boolean(),
      }),
    ),
    gif: gifSchema.nullable(),
    sticker: z.enum(STICKERS).nullable(),
    /** Files sent with the message; links come from the attachment link route. */
    attachments: z.array(
      z.object({
        id: z.uuid(),
        fileName: z.string(),
        mediaType: z.string(),
        sizeBytes: z.number().int(),
        width: z.number().int().nullable(),
        height: z.number().int().nullable(),
        hasPreview: z.boolean(),
      }),
    ),
    /** For a poll message: the poll to fetch (results depend on who asks, AC-F03-22). */
    pollId: z.uuid().nullable(),
    /** A note such as "Aisha Khan pinned a message" (kind "system"). */
    system: z
      .object({ event: z.enum(["pinned", "chat_mode"]), name: z.string(), mode: z.enum(CHAT_MODES).optional() })
      .nullable(),
  })
  .meta({ id: "ChatMessage" });
export type ChatMessageView = z.infer<typeof chatMessageSchema>;

export const messagesPageSchema = z
  .object({
    messages: z.array(chatMessageSchema),
    hasMore: z.boolean(),
    /** Pinned messages, oldest pin first (only on the first page). */
    pinned: z.array(chatMessageSchema).optional(),
    /** The newest news number when the first page was read; news after it arrives live (design 3.4). */
    lastSeq: z.number().int().optional(),
  })
  .meta({ id: "ChatMessagesPage" });

export const editMessageBodySchema = z.object({ body: messageDocumentSchema }).meta({ id: "EditChatMessage" });
export const reactionBodySchema = z.object({ emoji: z.string().min(1).max(40) }).meta({ id: "ChatReaction" });
export const pinBodySchema = z.object({ messageId: z.uuid() }).meta({ id: "PinChatMessage" });
export const pinnedListSchema = z.object({ pinned: z.array(chatMessageSchema) }).meta({ id: "PinnedChatMessages" });
export const reactionParamsSchema = chatMessageParamsSchema.extend({ emoji: z.string().min(1).max(40) });

export * from "./chat-extras.ts";
