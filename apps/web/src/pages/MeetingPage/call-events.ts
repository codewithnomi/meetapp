// What happens around the call (AC-F02-21, 23, 24, 33, 44): reactions shown for 3 seconds, the
// "X muted you" notice, and announcements for screen readers (joins and leaves, raised hands, being
// muted, the active speaker), at most one every 2 seconds.
import { useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  SHOWN_MS,
  useAnnouncer,
  type CallPerson,
  type ControlMessage,
  type Reaction,
} from "../../features/meetings/index.ts";

export function useReactions() {
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const show = (personId: string, reaction: Reaction) => {
    setReactions((old) => ({ ...old, [personId]: reaction }));
    setTimeout(
      () => setReactions((old) => Object.fromEntries(Object.entries(old).filter(([id]) => id !== personId))),
      SHOWN_MS,
    );
  };
  return { reactions, show };
}

type Change = [kind: string, text: string];

/** What changed between two lists: joins, leaves and newly raised hands. */
function changesBetween(before: Map<string, CallPerson>, people: CallPerson[], t: TFunction): Change[] {
  const now = new Set(people.map((p) => p.id));
  const joined = people
    .filter((p) => !before.has(p.id))
    .map((p): Change => [`join-${p.id}`, t("meetings.call.joined", { name: p.name })]);
  const left = [...before.values()]
    .filter((p) => !now.has(p.id))
    .map((p): Change => [`join-${p.id}`, t("meetings.call.left", { name: p.name })]);
  const hands = people
    .filter((p) => p.handRaisedAt && !before.get(p.id)?.handRaisedAt)
    .map((p): Change => [`hand-${p.id}`, t("meetings.call.raised", { name: p.name })]);
  return [...joined, ...left, ...hands];
}

/** Compares each new list of people with the last one and announces what changed. */
export function usePeopleAnnouncements(people: CallPerson[], announce: (kind: string, text: string) => void) {
  const { t } = useTranslation();
  const last = useRef<Map<string, CallPerson>>(new Map());
  useEffect(() => {
    const before = last.current;
    // The first list is everyone already there: nothing to announce.
    if (before.size > 0) for (const [kind, text] of changesBetween(before, people, t)) announce(kind, text);
    const speaker = people.find((p) => p.speaking && !p.isYou);
    if (speaker && !before.get(speaker.id)?.speaking)
      announce("speaker", t("meetings.call.isSpeaking", { name: speaker.name }));
    last.current = new Map(people.map((p) => [p.id, p]));
  }, [people, announce, t]);
}

export function useCallEvents() {
  const { t } = useTranslation();
  const announcer = useAnnouncer();
  const { reactions, show } = useReactions();
  const [mutedBy, setMutedBy] = useState<string>();
  const onControl = (message: ControlMessage) => {
    if (message.type !== "muted_by") return;
    const by = message.by ?? t("meetings.ended.someone");
    setMutedBy(by);
    announcer.announce("muted", t("meetings.call.mutedYou", { name: by }));
  };
  return { announcer, reactions, showReaction: show, mutedBy, clearMutedBy: () => setMutedBy(undefined), onControl };
}
