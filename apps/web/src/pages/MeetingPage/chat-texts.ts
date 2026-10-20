// Words and small helpers for the meeting chat (F03): names as shown, notes, times, first lines.
import type { ChatMessageView } from "@meetapp/contracts";
import type { TFunction } from "i18next";

export const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** "You" for the viewer's own messages in a call (`viewerId` is unknown after the meeting). */
export function senderName(t: TFunction, message: ChatMessageView, viewerId: string | undefined): string {
  if (viewerId !== undefined && message.sender.attendanceId === viewerId) return t("meetings.chat.you");
  const { name, group } = message.sender;
  return group === "member" ? name : t(`meetings.call.${group}`, { name });
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
