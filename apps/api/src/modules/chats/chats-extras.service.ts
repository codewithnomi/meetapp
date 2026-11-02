// Pins, polls, files and GIFs in one-to-one and group chats (F14 AC-F14-19), with F03's rules: any
// member pins or unpins (3 at most per chat) and creates polls (only the creator closes one); files are
// checked and cleaned as in meetings (25 MB, safe types, 10 a minute, 2 GB per chat); GIFs follow the
// workspace's switch. Rights come from the person's membership, as for messages.
import { AppError } from "../../plugins/errors.ts";
import { pinAs, unpinAs } from "../chat/chat-actions.service.ts";
import { pinnedViews } from "../chat/chat-access.ts";
import { linkTo, uploadAs, type FileStorage, type NewFile } from "../chat/chat-files.service.ts";
import { closeAs, createAs, pollFor, viewPoll, voteAs, type PollInput } from "../chat/chat-polls.service.ts";
import { viewerOf } from "../chat/chat-seat.ts";
import { gifSettingsFor, readable } from "../chat/chat.service.ts";
import { seatIn, type MessagesDeps } from "./chats-messages.service.ts";
import type { ChatsAction } from "./chats.permissions.ts";

export interface ExtrasDeps extends MessagesDeps {
  storage: FileStorage;
}

const notFound = () => new AppError(404, "NOT_FOUND", "Not found.");

interface In {
  userId: string;
  conversationId: string;
}

/** A download link only for files of messages the person may read (AC-F14-18, 19). */
async function link(deps: ExtrasDeps, seat: Awaited<ReturnType<typeof seatIn>>["seat"], file: FileAsk) {
  const row = await deps.meetingChat.files.byId(seat.conversationId, file.attachmentId);
  if (!row?.messageId || !(await readable(deps.meetingChat, seat, row.messageId))) throw notFound();
  return linkTo(deps.meetingChat, seat.conversationId, file.attachmentId, file.preview);
}

interface FileAsk {
  attachmentId: string;
  preview: boolean;
}

export function createChatsExtrasService(deps: ExtrasDeps) {
  const chat = deps.meetingChat;
  const seat = async ({ userId, conversationId }: In, action: ChatsAction) =>
    (await seatIn(deps, userId, conversationId, action)).seat;
  return {
    pin: async (where: In, messageId: string) => pinAs(chat, await seat(where, "pin"), messageId),
    unpin: async (where: In, messageId: string) => unpinAs(chat, await seat(where, "pin"), messageId),
    pinned: async (where: In) => {
      const reader = await seat(where, "read");
      return { pinned: await pinnedViews(chat, reader.conversationId, viewerOf(reader)) };
    },
    createPoll: async (where: In, input: PollInput) => createAs(chat, await seat(where, "createPoll"), input),
    poll: async (where: In, pollId: string) => {
      const reader = await seat(where, "read");
      return viewPoll(chat, await pollFor(chat, reader, pollId), reader);
    },
    // Voting changes the chat like a reaction does, so it follows the same rights.
    vote: async (where: In, pollId: string, optionIds: string[]) =>
      voteAs(chat, await seat(where, "react"), pollId, optionIds),
    closePoll: async (where: In, pollId: string) => closeAs(chat, await seat(where, "react"), pollId),
    upload: async (where: In, file: NewFile) => uploadAs(chat, deps.storage, await seat(where, "send"), file),
    link: async (where: In, file: FileAsk) => link(deps, await seat(where, "read"), file),
    gifSettings: async (where: In) => gifSettingsFor(chat, await seat(where, "send")),
  };
}

export type ChatsExtrasService = ReturnType<typeof createChatsExtrasService>;
