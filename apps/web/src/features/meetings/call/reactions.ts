// Reactions (AC-F02-24, design 3.6): one of five names sent as LiveKit data on "meetapp.reaction",
// shown on the sender's tile for 3 seconds. An app sends at most one a second; receivers ignore
// anything else on the topic and extra ones from the same person.
export const REACTION_TOPIC = "meetapp.reaction";
export const REACTIONS = ["like", "love", "applause", "laugh", "surprised"] as const;
export type Reaction = (typeof REACTIONS)[number];
export const EMOJI: Record<Reaction, string> = { like: "👍", love: "❤️", applause: "👏", laugh: "😂", surprised: "😮" };
export const SHOWN_MS = 3_000;
const GAP_MS = 1_000;

export function encodeReaction(reaction: Reaction): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify({ reaction }));
}

/** The reaction in a message, or undefined for anything that isn't one of the five. */
export function decodeReaction(payload: Uint8Array): Reaction | undefined {
  try {
    const value = (JSON.parse(new TextDecoder().decode(payload)) as { reaction?: unknown }).reaction;
    return (REACTIONS as readonly unknown[]).includes(value) ? (value as Reaction) : undefined;
  } catch {
    return undefined;
  }
}

/** One a second per sender: answers whether this one may be shown (or sent). */
export function createGate(now: () => number = Date.now) {
  const last = new Map<string, number>();
  return (who: string): boolean => {
    const at = now();
    if (at - (last.get(who) ?? -Infinity) < GAP_MS) return false;
    last.set(who, at);
    return true;
  };
}
