// F04: checking a notification card from a main window (design.md 3.4; TC-F04-89). Unknown kinds and
// keys are refused; text is cut to 100 characters and names to 80; photos follow F16's rules (PNG, JPEG
// or WebP data pictures of about 400 KB at most). The card is shown as plain text only.
import type { NoticeCard } from "@meetapp/contracts";
import { z } from "zod";

const cut = (max: number) =>
  z
    .string()
    .max(10_000)
    .transform((text) => text.slice(0, max));
const photo = z
  .string()
  .max(400_100)
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]*$/);
const person = z.strictObject({ name: cut(80), initials: z.string().max(4), photo: photo.optional() });

const base = {
  // F13 reminder ids carry the person, the meeting and the time (about 115 characters).
  id: z.string().min(1).max(200),
  title: cut(80),
  detail: cut(80).optional(),
  text: cut(100).optional(),
  tag: cut(40).optional(),
  person: person.optional(),
  close: cut(40),
};
const cardSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...base, kind: z.enum(["message", "mention", "running", "invite"]) }),
  // Three or more waiting: one card with View lobby only (AC-F04-34).
  z.strictObject({ ...base, kind: z.literal("lobby"), admit: cut(40).optional(), viewLobby: cut(40) }),
  // F13: a meeting reminder (AC-F13-21); no Join once the meeting can't be joined.
  z.strictObject({
    ...base,
    kind: z.literal("reminder"),
    join: cut(40).optional(),
    snooze: cut(40),
    dismiss: cut(40),
  }),
]);

/** The card, checked and cut, or undefined when it is refused. */
export function cleanCard(value: unknown): NoticeCard | undefined {
  const parsed = cardSchema.safeParse(value);
  if (!parsed.success) return undefined;
  // Leave out keys that came as undefined (exact optional types).
  return Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined)) as unknown as NoticeCard;
}

/** Which buttons each kind of card has: a message opens its chat; the lobby has Admit and View lobby; a
 * reminder Join, Snooze and Dismiss. */
export const CHOICES: Record<NoticeCard["kind"], readonly string[]> = {
  message: ["open"],
  mention: ["open"],
  lobby: ["open", "admit", "viewLobby"],
  running: [],
  reminder: ["open", "join", "snooze", "dismiss"],
  invite: ["open"],
};
