// One-to-one and group chats (F14 design.md 3–5): conversations, members, requests, read marks,
// status, and the messages on the live line (D064). Shared by the backend, the apps and the API docs.
import { z } from "zod";
import { chatEventSchema } from "./chat-news.ts";

export const CONVERSATION_KINDS = ["direct", "group", "meeting"] as const;
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];

export const MEMBER_STATES = ["accepted", "pending", "declined", "left", "removed"] as const;
export type MemberState = (typeof MEMBER_STATES)[number];

export const STATUSES = ["available", "away", "in_meeting", "offline"] as const;
export type Status = (typeof STATUSES)[number];

/** Limits from the requirements (AC-F14-05, 12, 15, 16, 17) and design 3.4. */
export const CHATS_LIMITS = {
  groupMin: 3,
  groupMax: 250,
  groupName: 80,
  pinnedChats: 15,
  messagesWhilePending: 10,
  requestsPerDay: 20,
  historyDaysMax: 365,
  seenGroupMax: 20,
  lineMessageBytes: 64 * 1024,
  linesPerPerson: 5,
} as const;

/** Why a chat is read-only (the app's note): a block, outside chat off, the other person left. */
export const READ_ONLY_REASONS = ["blocked", "outside_off", "left_workspace", "left"] as const;
export type ReadOnlyReason = (typeof READ_ONLY_REASONS)[number];

export const LIST_FILTERS = ["all", "unread", "chats", "meetings"] as const;

const person = z.object({
  userId: z.uuid(),
  name: z.string(),
  photoUrl: z.string().nullable(),
  /** Not a member of the conversation's workspace: shown "(External)". */
  external: z.boolean(),
});

/** One row of the chat list (AC-F14-01, 02, 05). */
export const conversationListItemSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(CONVERSATION_KINDS),
    /** A meeting chat's meeting (opened with F03's rules), else null. */
    meetingId: z.uuid().nullable(),
    /** The other person, the group's name, its members' names, or the meeting's title. */
    title: z.string(),
    /** Up to 3 people for the picture (direct: the other person; group: first members). */
    people: z.array(person).max(3),
    /** The other person's status in a direct chat (when allowed to see it), else null. */
    status: z.enum(STATUSES).nullable(),
    lastMessage: z
      .object({ senderName: z.string(), own: z.boolean(), firstLine: z.string(), at: z.iso.datetime() })
      .nullable(),
    unread: z.number().int().min(0),
    mentioned: z.boolean(),
    pinned: z.boolean(),
    muted: z.boolean(),
    /** Read-only: blocked direct chat, outside chat off, or left/removed (design 3.2). */
    readOnly: z.boolean(),
    /** Why (for the note); `left`: this person left or was removed. */
    readOnlyReason: z.enum(READ_ONLY_REASONS).nullable(),
    /** The starter's side of an unanswered request: "Waiting for <name> to accept" or, after 30 days,
     * "<name> didn't accept" (AC-F14-10, 12). A deleted request still reads "waiting" (AC-F14-11). */
    request: z.enum(["waiting", "not_accepted"]).nullable(),
  })
  .meta({ id: "ConversationListItem" });
export type ConversationListItem = z.infer<typeof conversationListItemSchema>;

export const conversationListSchema = z
  .object({ conversations: z.array(conversationListItemSchema), unreadChats: z.number().int().min(0) })
  .meta({ id: "ConversationList" });
export type ConversationList = z.infer<typeof conversationListSchema>;

export const listQuerySchema = z.object({
  filter: z.enum(LIST_FILTERS).default("all"),
  q: z.string().max(100).optional(),
});

/** Start a chat: one person opens the direct chat, two or more make a group (AC-F14-07, 09, 15). */
export const startConversationBodySchema = z
  .object({
    /** Up to 250 so a 251st is refused with the limit's own message (CHAT_GROUP_FULL). */
    userIds: z.array(z.uuid()).max(CHATS_LIMITS.groupMax).default([]),
    emails: z
      .array(z.email())
      .max(CHATS_LIMITS.groupMax - 1)
      .default([]),
    name: z.string().trim().min(1).max(CHATS_LIMITS.groupName).optional(),
  })
  .meta({ id: "StartConversation" });

export const startedConversationSchema = z
  .object({ id: z.uuid(), created: z.boolean() })
  .meta({ id: "StartedConversation" });

export const conversationParamsSchema = z.object({ conversationId: z.string() });

/** A suggestion in New chat's To: field (AC-F14-07, 08; D063). */
export const peopleResultSchema = z
  .object({
    people: z.array(person.extend({ status: z.enum(STATUSES).nullable() })),
    /** An exact email with no MeetApp account: offer an invitation. */
    noAccount: z.boolean(),
  })
  .meta({ id: "ChatPeople" });

export const peopleQuerySchema = z.object({ q: z.string().max(254).default("") });
export const inviteToMeetAppBodySchema = z.object({ email: z.email().max(254) }).meta({ id: "InviteToMeetApp" });

export const historyChoiceSchema = z.discriminatedUnion("from", [
  z.object({ from: z.literal("none") }),
  z.object({ from: z.literal("days"), days: z.number().int().min(1).max(CHATS_LIMITS.historyDaysMax) }),
  z.object({ from: z.literal("all") }),
]);

export const addPeopleBodySchema = z
  .object({
    userIds: z.array(z.uuid()).min(1).max(CHATS_LIMITS.groupMax),
    /** All history is the default, as in Teams (AC-F14-17). */
    history: historyChoiceSchema.default({ from: "all" }),
  })
  .meta({ id: "AddChatPeople" });

export const renameBodySchema = z
  .object({ name: z.string().trim().min(1).max(CHATS_LIMITS.groupName) })
  .meta({ id: "RenameChat" });
export const chatMemberParamsSchema = z.object({ conversationId: z.string(), userId: z.uuid() });

export const conversationMessageParamsSchema = z.object({ conversationId: z.string(), messageId: z.uuid() });
export const conversationReactionParamsSchema = conversationMessageParamsSchema.extend({
  emoji: z.string().min(1).max(40),
});

export const conversationPollParamsSchema = z.object({ conversationId: z.string(), pollId: z.string() });
export const conversationFileParamsSchema = z.object({ conversationId: z.string(), attachmentId: z.string() });

/** Who has seen a message (AC-F14-24): `null` when receipts don't apply (big group, receipts off). */
export const seenSchema = z
  .object({ people: z.array(z.object({ userId: z.uuid(), name: z.string() })).nullable() })
  .meta({ id: "ChatSeen" });
export const myChatPrefsBodySchema = z.object({ readReceipts: z.boolean() }).meta({ id: "MyChatPrefs" });

/** Statuses of up to 100 people (AC-F14-26); people the asker may not see are left out. */
export const statusQuerySchema = z.object({
  ids: z
    .string()
    .transform((value) => value.split(",").filter(Boolean))
    .pipe(z.array(z.uuid()).max(100)),
});
export const statusesSchema = z
  .object({ statuses: z.array(z.object({ userId: z.uuid(), status: z.enum(STATUSES) })) })
  .meta({ id: "ChatStatuses" });

export const readMarkBodySchema = z.object({ seq: z.number().int().min(0) }).meta({ id: "ChatReadMark" });
/** A chat request waiting for this person (AC-F14-10): who sent it and a preview of its messages. */
const chatRequestSchema = z
  .object({
    conversationId: z.uuid(),
    kind: z.enum(["direct", "group"]),
    from: person.omit({ external: true }).extend({ email: z.string() }),
    /** A group's name, when it has one. */
    groupName: z.string().nullable(),
    requestedAt: z.iso.datetime(),
    preview: z
      .array(z.object({ senderName: z.string(), text: z.string(), at: z.iso.datetime() }))
      .max(CHATS_LIMITS.messagesWhilePending),
  })
  .meta({ id: "ChatRequest" });
export const chatRequestsSchema = z.object({ requests: z.array(chatRequestSchema) }).meta({ id: "ChatRequests" });

export const blockedPeopleSchema = z
  .object({ people: z.array(person.omit({ external: true })) })
  .meta({ id: "BlockedPeople" });
export const blockBodySchema = z.object({ userId: z.uuid() }).meta({ id: "BlockPerson" });
export const blockedParamsSchema = z.object({ userId: z.uuid() });

export const declineBodySchema = z.object({ block: z.boolean().default(false) }).meta({ id: "DeclineChat" });
export const myChatSettingsBodySchema = z
  .object({ pinned: z.boolean(), muted: z.boolean(), hidden: z.boolean() })
  .partial()
  .meta({ id: "MyChatSettings" });

/** Messages on the live line (design 3.4). Server → app. */
export const lineServerMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("news"), conversationId: z.uuid(), event: chatEventSchema }),
  z.object({ t: z.literal("typing"), conversationId: z.uuid(), userId: z.uuid(), name: z.string() }),
  z.object({ t: z.literal("read"), conversationId: z.uuid(), userId: z.uuid(), seq: z.number().int() }),
  z.object({ t: z.literal("status"), userId: z.uuid(), status: z.enum(STATUSES) }),
  z.object({ t: z.literal("list"), conversationId: z.uuid(), change: z.enum(["added", "changed", "removed"]) }),
  z.object({ t: z.literal("pong") }),
]);
export type LineServerMessage = z.infer<typeof lineServerMessageSchema>;

/** App → server: only these; anything else closes the line (design 3.4). */
export const lineAppMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("typing"), conversationId: z.uuid() }),
  z.object({ t: z.literal("active"), active: z.boolean() }),
  z.object({ t: z.literal("ping") }),
]);
export type LineAppMessage = z.infer<typeof lineAppMessageSchema>;
