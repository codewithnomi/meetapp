// Why a chat is read-only for a member who may otherwise write (F14 AC-F14-13, 27, 33, 34), so the app
// can show the right note: a block between the two people, outside chat turned off while the chat has
// someone from outside, or the other person left the workspace (or deleted their account).
import type { ReadOnlyReason } from "@meetapp/contracts";

interface Member {
  userId: string;
  state: string;
  external: boolean;
}

export interface ReadOnlyFacts {
  kind: "direct" | "group" | "meeting";
  userId: string;
  people: Member[];
  /** Blocks between this person and the other one in a one-to-one chat. */
  blocked: boolean;
  /** The conversation's workspace allows chat with people outside (AC-F14-27). */
  outsideAllowed: boolean;
}

const inChat = (person: Member) => person.state === "accepted" || person.state === "pending";

export function readOnlyReason(facts: ReadOnlyFacts): ReadOnlyReason | null {
  if (facts.kind === "direct") {
    const other = facts.people.find((person) => person.userId !== facts.userId);
    if (!other || other.state === "left" || other.state === "removed") return "left_workspace";
    if (facts.blocked) return "blocked";
  }
  if (!facts.outsideAllowed && facts.people.some((person) => person.external && inChat(person))) return "outside_off";
  return null;
}
