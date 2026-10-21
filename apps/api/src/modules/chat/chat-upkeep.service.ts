// Chat upkeep (F03 design.md 3.4, 3.8, 4 and 6): the note and news when the chat setting changes during
// a call, the minute-by-minute clean-up, and what a deleted account or a data request needs.
import { randomUUID } from "node:crypto";
import type { ChatMode } from "@meetapp/contracts";
import { broadcast, viewOne, type ChatDeps } from "./chat-access.ts";
import type { FileStorage } from "./chat-files.service.ts";
import type { ChatUpkeepRepository } from "./chat-upkeep.repository.ts";

const EVENTS_KEPT_MS = 24 * 60 * 60 * 1000;
const UNSENT_KEPT_MS = 60 * 60 * 1000;

export interface UpkeepDeps extends ChatDeps {
  upkeep: ChatUpkeepRepository;
  storage: FileStorage;
}

/** "<name> turned chat off", saved and delivered with the new setting (AC-F03-37). */
async function modeChanged(deps: UpkeepDeps, meetingId: string, byName: string): Promise<void> {
  const call = await deps.calls.calls.runningFor(meetingId);
  const row = await deps.calls.meetings.find(meetingId);
  if (!call || !row) return;
  const mode: ChatMode = row.meeting.chatMode;
  const saved = await deps.chat.insertMessage(
    {
      workspaceId: row.meeting.workspaceId,
      meetingId,
      callId: call.id,
      senderAttendanceId: null,
      senderName: byName,
      senderGroup: "member",
      kind: "system",
      system: { event: "chat_mode", name: byName, mode },
      clientId: randomUUID(),
    },
    "message_created",
  );
  if (!saved.created) return;
  const view = await viewOne(deps, saved.message);
  await broadcast(deps, call.id, { seq: saved.seq, type: "chat_mode_changed", id: view.id, message: view });
}

/** Old catch-up news, deleted messages' files and files never sent are removed (design 3.4, 6). */
async function cleanUp(deps: UpkeepDeps): Promise<void> {
  const now = deps.calls.now().getTime();
  await deps.upkeep.forgetEventsBefore(new Date(now - EVENTS_KEPT_MS));
  for (const file of await deps.upkeep.filesToRemove(new Date(now - UNSENT_KEPT_MS))) {
    // A file that is already gone is fine; the row goes only after its file, so nothing is left behind.
    await deps.storage.delete(file.storageKey);
    if (file.previewKey) await deps.storage.delete(file.previewKey);
    await deps.upkeep.forgetFile(file.id);
  }
}

export function createChatUpkeepService(deps: UpkeepDeps) {
  return {
    modeChanged: (meetingId: string, byName: string) => modeChanged(deps, meetingId, byName),
    cleanUp: () => cleanUp(deps),
    /** Called by the account deletion (F10; until then by support, privacy-legal.md). */
    forgetPerson: (userId: string) => deps.upkeep.forgetPerson(userId),
    exportFor: (userId: string) => deps.upkeep.exportFor(userId),
    /** Called before a meeting record is deleted (F06/F10), so its files are removed too (AC-F03-43). */
    beforeMeetingDeleted: (meetingId: string) => deps.upkeep.markMeetingFiles(meetingId),
  };
}
