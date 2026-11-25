// Meeting cards (F13 design.md "Reminder"; AC-F13-17, 21, 22): a due reminder on the live line (or still
// due when the app starts or reconnects) becomes "Starts in 15 min" / "Starting now" with Join, Snooze
// and Dismiss; an invite becomes "<Organizer> invited you to <title>" when "Meeting invites" is on. None
// on Do not disturb. Snooze and Dismiss tell the server, which closes the card in every other window.
// Card ids carry the person, so the desktop app shows one card even with several windows open.
import type { NoticeCard, NoticeChoice, Reminder, ScheduleDetails } from "@meetapp/contracts";
import { useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { apiRequest } from "../api/index.ts";
import { useSession } from "../auth/index.ts";
import { useLiveLine } from "../chats/index.ts";
import { useFindMeeting, type PreJoinState } from "../meetings/index.ts";
import { chime, isQuiet } from "../notices/index.ts";
import { useNotificationSettings } from "../notifications/index.ts";
import { useCurrentWorkspace } from "../workspaces/index.ts";
import { formatRange, type TimeFormat } from "./time-format.ts";

type Bridge = {
  notices?: { show: (card: NoticeCard) => void; remove: (cardId: string) => void };
  callWindows?: { onAction: (listener: (action: unknown) => void) => () => void };
};
const bridge = () => (window as { meetapp?: Bridge }).meetapp;

type ReminderKey = Pick<Reminder, "meetingId" | "originalStart" | "kind">;
type Line =
  | ({ t: "reminder" } & Reminder)
  | ({ t: "reminder-dismissed" } & ReminderKey)
  | { t: "invited"; meetingId: string; title: string; organizerName: string }
  | { t: "connected" }
  | { t: string };

const timeFormat = (): TimeFormat => ({
  locale: navigator.language,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

export const reminderCardId = (me: string, r: ReminderKey) =>
  `reminder:${me}:${r.meetingId}|${r.originalStart}|${r.kind}`;

/** The reminder's card (TC-F13-36): minutes left, or "Starting now"; no Join once it has ended. */
export function reminderCard(
  me: string,
  r: Reminder,
  at: { now: number; t: TFunction; format: TimeFormat },
): NoticeCard {
  const { now, t, format: f } = at;
  const minutes = Math.round((Date.parse(r.startsAt) - now) / 60_000);
  return {
    id: reminderCardId(me, r),
    kind: "reminder",
    title: r.title,
    detail: r.allDay ? t("calendar.allDay") : formatRange(new Date(r.startsAt), new Date(r.endsAt), f),
    tag: r.kind === "start" || minutes <= 0 ? t("notices.reminder.now") : t("notices.reminder.soon", { minutes }),
    ...(Date.parse(r.endsAt) > now ? { join: t("notices.reminder.join") } : {}),
    snooze: t("notices.reminder.snooze"),
    dismiss: t("notices.reminder.dismiss"),
    close: t("notices.close"),
  };
}

type Invite = Extract<Line, { t: "invited" }>;

/** "<Organizer> invited you to <title>" (AC-F13-17). */
export const inviteCard = (me: string, invite: Invite, t: TFunction): NoticeCard => ({
  id: `invite:${me}:${invite.meetingId}`,
  kind: "invite",
  title: invite.organizerName,
  text: t("notices.invited", { title: invite.title }),
  close: t("notices.close"),
});

/** The reminders still due in the open workspace; none when that can't be read. */
const due = (workspaceId: string) =>
  apiRequest<{ reminders: Reminder[] }>(
    `/api/v1/workspaces/${workspaceId}/reminders/due?timeZone=${encodeURIComponent(timeFormat().timeZone)}`,
  )
    .then((body) => body.reminders)
    .catch(() => [] as Reminder[]);

export interface SchedulingNoticesOptions {
  /** Join: the meeting's pre-join (the page looks the meeting up). */
  onJoin: (meetingId: string) => void;
  /** The card's text: the meeting's details in the calendar. */
  onOpen: (meetingId: string, originalStart?: string) => void;
}

interface Shown {
  reminder?: Reminder;
  meetingId: string;
}

const dismiss = (r: ReminderKey, snooze: boolean) =>
  apiRequest("/api/v1/reminders/dismiss", {
    method: "POST",
    body: { meetingId: r.meetingId, originalStart: r.originalStart, kind: r.kind, snooze },
  }).catch(() => undefined);

/** A card's button, back from the desktop app. */
function useChosen(shown: Map<string, Shown>, options: SchedulingNoticesOptions) {
  const latest = useRef(options);
  latest.current = options;
  useEffect(
    () =>
      bridge()?.callWindows?.onAction((action) => {
        const chosen = action as { name?: string; cardId?: string; choice?: NoticeChoice | "close" | "pushed" };
        const card = chosen.name === "noticeChosen" ? shown.get(chosen.cardId ?? "") : undefined;
        if (!card || !chosen.cardId) return;
        shown.delete(chosen.cardId);
        const { reminder } = card;
        if (chosen.choice === "join") latest.current.onJoin(card.meetingId);
        if (chosen.choice === "open") latest.current.onOpen(card.meetingId, reminder?.originalStart);
        if (reminder && (chosen.choice === "snooze" || chosen.choice === "dismiss" || chosen.choice === "close"))
          void dismiss(reminder, chosen.choice === "snooze");
      }),
    [shown],
  );
}

export function useSchedulingNotices(options: SchedulingNoticesOptions): void {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const { data: me } = useSession();
  const { current } = useCurrentWorkspace();
  const { settings } = useNotificationSettings();
  const shown = useRef(new Map<string, Shown>()).current;
  const latest = useRef({ me: me?.id, workspaceId: current?.id, settings, t });
  latest.current = { me: me?.id, workspaceId: current?.id, settings, t };
  const lineRef = useRef<{ serverNow: () => number } | undefined>(undefined);
  useChosen(shown, options);
  useEffect(() => () => [...shown.keys()].forEach((id) => bridge()?.notices?.remove(id)), [shown]);

  const listener = useRef((message: Line) => {
    const { me: userId, workspaceId, settings: on, t: words } = latest.current;
    const now = lineRef.current?.serverNow() ?? Date.now();
    if (!userId || isQuiet(queries.getQueryData(["me", "status"]), now)) return;
    const put = (card: NoticeCard, entry: Shown) => {
      if (shown.has(card.id)) return;
      shown.set(card.id, entry);
      bridge()?.notices?.show(card);
      if (on.sound) chime();
    };
    const remind = (r: Reminder) =>
      Date.parse(r.endsAt) > now &&
      put(reminderCard(userId, r, { now, t: words, format: timeFormat() }), { reminder: r, meetingId: r.meetingId });
    if (message.t === "reminder") remind(message as Reminder);
    if (message.t === "reminder-dismissed") {
      const id = reminderCardId(userId, message as ReminderKey);
      if (shown.delete(id)) bridge()?.notices?.remove(id);
    }
    if (message.t === "invited" && on.invites) {
      const invite = message as Invite;
      put(inviteCard(userId, invite, words), { meetingId: invite.meetingId });
    }
    // On start and reconnect: reminders still due, never for meetings already over (AC-F13-22).
    if (message.t === "connected" && workspaceId) {
      void due(workspaceId).then((reminders) => reminders.forEach(remind));
    }
  }).current;
  lineRef.current = useLiveLine(listener);
}

/** Join from a card: the meeting's link from its details, then F02's pre-join. */
export function useJoinScheduled(onPreJoin: (state: PreJoinState) => void): (meetingId: string) => void {
  const find = useFindMeeting();
  return (meetingId) =>
    void apiRequest<ScheduleDetails>(`/api/v1/meetings/${meetingId}/schedule`)
      .then(({ link }) =>
        find.mutate(
          { link },
          {
            onSuccess: (m) => onPreJoin({ title: m.title, lookupToken: m.lookupToken, group: m.group, address: link }),
          },
        ),
      )
      .catch(() => undefined);
}
