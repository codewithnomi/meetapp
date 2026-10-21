// Words and small helpers for the meeting chat (F03): names as shown, notes, times, first lines.
import type { ChatEvent, ChatMessageView } from "@meetapp/contracts";
import type { TFunction } from "i18next";

export const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * The viewer's own message: from this join, or from an earlier join of the same account (after a rejoin;
 * the server allows editing those too). Unknown after the meeting.
 */
export function isOwn(message: ChatMessageView, viewerId: string | undefined, viewerUserId?: string): boolean {
  if (viewerId !== undefined && message.sender.attendanceId === viewerId) return true;
  return viewerUserId !== undefined && message.sender.userId === viewerUserId;
}

/** "You" for the viewer's own messages in a call. */
export function senderName(
  t: TFunction,
  message: ChatMessageView,
  viewerId: string | undefined,
  viewerUserId?: string,
): string {
  if (isOwn(message, viewerId, viewerUserId)) return t("meetings.chat.you");
  const { name, group } = message.sender;
  return group === "member" ? name : t(`meetings.call.${group}`, { name });
}

/** Same person, same minute, no note in between: shown as a connected bubble without name and time (AC-F03-48). */
export function continuesGroup(previous: ChatMessageView | undefined, message: ChatMessageView): boolean {
  if (!previous || previous.kind === "system" || message.kind === "system") return false;
  return (
    previous.sender.attendanceId === message.sender.attendanceId &&
    time(previous.createdAt) === time(message.createdAt) &&
    previous.createdAt.slice(0, 10) === message.createdAt.slice(0, 10)
  );
}

export function noteText(t: TFunction, message: ChatMessageView): string {
  const system = message.system;
  if (!system) return "";
  if (system.event === "pinned") return t("meetings.chat.pinnedNote", { name: system.name });
  return t(`meetings.chat.modeNote.${system.mode ?? "on"}`, { name: system.name });
}

/** The first line of a message's text, for the pinned bar and quotes. */
export function firstLineOf(message: ChatMessageView): string {
  const first = message.body?.blocks[0];
  if (first?.type === "codeBlock") return first.text.split("\n")[0] ?? "";
  if (first?.type !== "paragraph") return "…";
  return (first.content ?? []).map((part) => (part.type === "text" ? part.text : " ")).join("");
}

/** All of a message's text, for "Copy text". */
export function allTextOf(message: ChatMessageView): string {
  const lines = (message.body?.blocks ?? []).map((block) => {
    if (block.type === "codeBlock") return block.text;
    if (block.type === "paragraph")
      return (block.content ?? []).map((p) => (p.type === "text" ? p.text : "\n")).join("");
    return "";
  });
  return lines.join("\n");
}

export function copyText(text: string) {
  void navigator.clipboard.writeText(text).catch(() => undefined);
}

/**
 * What a screen reader hears for news while the chat panel is closed: "New message from Bilal Ahmed: hi"
 * (AC-F03-45). With the panel open, its message list (a log) is read out instead; own messages and notes
 * are not announced.
 */
export function chatAnnouncement(
  t: TFunction,
  event: ChatEvent,
  viewerId: string,
  panelOpen: boolean,
): string | undefined {
  const message = event.message;
  if (event.type !== "message_created" || !message || panelOpen || message.kind === "system") return undefined;
  if (message.sender.attendanceId === viewerId) return undefined;
  return t("meetings.chat.announce", { name: senderName(t, message, viewerId), text: firstLineOf(message) });
}
