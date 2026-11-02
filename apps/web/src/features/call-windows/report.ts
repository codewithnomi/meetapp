// The report a main window sends to the desktop app for F16's small windows (design.md 3.1): the rings,
// the current call and the rings that just ended as missed. Pure, so it can be tested.
import type { CallWindowsCall, CallWindowsMissed, CallWindowsState, RingMessage } from "@meetapp/contracts";
import type { TFunction } from "i18next";

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/** The rings (newest first), each saying which call or meeting accepting would leave (AC-F16-07). */
export function buildReport(
  rings: RingMessage[],
  busyIn: string | undefined,
  call: CallWindowsCall | null,
  missed: CallWindowsMissed[],
): CallWindowsState {
  return {
    rings: rings.map((ring) => ({
      callId: ring.callId,
      caller: { name: ring.from.name, initials: initialsOf(ring.from.name) },
      kind: ring.media,
      ...(ring.groupName ? { chatName: ring.groupName } : {}),
      ...(busyIn ? { busyIn } : {}),
    })),
    call,
    missed,
  };
}

/** A ring that ended unanswered becomes a missed call, worded for the notification (AC-F16-10, 23). */
export function missedCall(ring: RingMessage, endedAt: number, t: TFunction): CallWindowsMissed {
  const name = ring.from.name;
  return {
    callId: ring.callId,
    from: name,
    ...(ring.groupName ? { chatName: ring.groupName } : {}),
    kind: ring.media,
    conversationId: ring.conversationId,
    endedAt,
    text: {
      title: t("calls.windows.missedTitle"),
      body: ring.groupName
        ? t("calls.windows.missedFromIn", { name, chat: ring.groupName })
        : t("calls.windows.missedFrom", { name }),
      callBack: t("calls.windows.callBack"),
    },
  };
}

/** The few things the mini window needs about a person in the call. */
interface Person {
  name: string;
  isYou: boolean;
  speaking: boolean;
  micOn: boolean;
  cameraOn: boolean;
  handRaisedAt: string | undefined;
  screen: unknown;
}

export interface CallScreenFacts {
  title: string;
  joinedAt: number;
  people: Person[];
  connection: "connecting" | "connected" | "reconnecting" | "failed";
  may: { microphone: boolean; screen: boolean };
  /** The person's role may share (presenters and up, AC-F02-25). */
  mayShare: boolean;
}

/** Whom the mini window shows: whoever shares, else whoever speaks, else someone else, else you. */
function speakerOf(people: Person[]): Person | undefined {
  const others = people.filter((p) => !p.isYou);
  return people.find((p) => p.screen) ?? others.find((p) => p.speaking) ?? others[0] ?? people.find((p) => p.isYou);
}

/** The call as the mini window shows it (AC-F16-15, 18), from what the call screen knows. */
export function callForWindows(facts: CallScreenFacts): CallWindowsCall {
  const me = facts.people.find((p) => p.isYou);
  const speaker = speakerOf(facts.people);
  const name = speaker?.name ?? facts.title;
  return {
    title: facts.title,
    joinedAt: facts.joinedAt,
    people: facts.people.length,
    phase: facts.connection === "reconnecting" ? "reconnecting" : "in-call",
    speaker: {
      name,
      initials: initialsOf(name),
      hasVideo: Boolean(speaker?.cameraOn),
      sharing: Boolean(speaker?.screen),
    },
    mic: Boolean(me?.micOn),
    camera: Boolean(me?.cameraOn),
    hand: Boolean(me?.handRaisedAt),
    canUnmute: facts.may.microphone,
    canShare: facts.may.screen && facts.mayShare,
  };
}
