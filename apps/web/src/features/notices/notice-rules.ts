// Which new chat messages give a notification card, and what it says (F04 design 3.4; AC-F04-31, 32, 33):
// never one's own message, the chat shown in a window in front, a muted chat (unless it mentions the
// person), a kind switched off, or a message over 5 minutes old by the server's clock. A mention gives one
// "mentioned you" card, never a plain one too. Do not disturb silences them all. With preview off the card says "New message". Messages of
// the same chat merge into one card while it shows. Pure, so it can be tested.
import type { ChatMessageView as ChatMessage, NotificationSettings } from "@meetapp/contracts";

export const MAX_AGE_MS = 5 * 60_000;
/** A card shows this long (main's own timer); a message within it joins the card. */
export const SHOWING_MS = 8_000;
const TEXT_MAX = 100;

export interface ChatInfo {
  title: string;
  kind: "direct" | "group" | "meeting";
  muted: boolean;
  photoUrl: string | null;
}

export interface Incoming {
  conversationId: string;
  message: ChatMessage;
  chat: ChatInfo | undefined;
  me: string;
  /** The chat open in a MeetApp window in front, if any. */
  shownChat: string | undefined;
  settings: NotificationSettings;
  serverNow: number;
  /** Do not disturb, as the server holds it (AC-F04-22). */
  quiet: boolean;
}

/** Only a hand-set Do not disturb that hasn't run out silences cards (TC-F04-47); calls still ring. */
export function isQuiet(mine: { chosen: string | null; until: string | null } | undefined, serverNow: number): boolean {
  if (mine?.chosen !== "dnd") return false;
  return mine.until === null || Date.parse(mine.until) > serverNow;
}

export type Decision = { show: false } | { show: true; mention: boolean; text: string | null };

/** Every piece of text in a message document, in order. */
function textOf(node: unknown): string {
  if (typeof node !== "object" || node === null) return "";
  const n = node as { text?: unknown; content?: unknown; items?: unknown; blocks?: unknown };
  if (typeof n.text === "string") return n.text;
  const children = [n.content, n.items, n.blocks].find(Array.isArray) as unknown[] | undefined;
  return (children ?? []).map(textOf).join(" ");
}

function mentions(node: unknown, me: string): boolean {
  if (typeof node !== "object" || node === null) return false;
  const n = node as Record<string, unknown>;
  if (n["type"] === "mention" && n["userId"] === me) return true;
  return Object.values(n).some((value) => (Array.isArray(value) ? value.some((v) => mentions(v, me)) : false));
}

/** The message's first 100 characters, spaces tidied; null when there is no text (a GIF, a sticker). */
export function previewText(message: ChatMessage): string | null {
  const text = textOf(message.body).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, TEXT_MAX) : null;
}

export function decide(incoming: Incoming): Decision {
  const { message, chat, me, settings } = incoming;
  const skip = { show: false } as const;
  if (incoming.quiet) return skip;
  if (message.kind === "system" || message.sender.userId === me || message.deletedAt) return skip;
  if (incoming.shownChat === incoming.conversationId) return skip;
  if (incoming.serverNow - Date.parse(message.createdAt) > MAX_AGE_MS) return skip;
  const mention = mentions(message.body, me);
  // A mention never turns into a plain card, even with mentions off (AC-F04-33).
  if (mention) return settings.mentions ? { show: true, mention, text: previewText(message) } : skip;
  if (!settings.messages || chat?.muted) return skip;
  return { show: true, mention: false, text: previewText(message) };
}

/** One card per chat while it shows: how many messages it holds and when it was last changed. */
export class Merger {
  private readonly open = new Map<string, { cardId: string; count: number; at: number }>();
  private made = 0;

  /** The card for this chat's new message: a new card (with its sound) or the showing one, one more. */
  add(conversationId: string, now: number): { cardId: string; count: number; fresh: boolean } {
    const showing = this.open.get(conversationId);
    if (showing && now - showing.at < SHOWING_MS) {
      showing.count += 1;
      showing.at = now;
      return { cardId: showing.cardId, count: showing.count, fresh: false };
    }
    this.made += 1;
    const card = { cardId: `chat:${conversationId}:${String(this.made)}`, count: 1, at: now };
    this.open.set(conversationId, card);
    return { ...card, fresh: true };
  }

  /** The card closed (clicked or ×): the next message makes a new one. */
  closed(cardId: string): void {
    for (const [id, card] of this.open) if (card.cardId === cardId) this.open.delete(id);
  }

  cardIds(): string[] {
    return [...this.open.values()].map((card) => card.cardId);
  }
}
