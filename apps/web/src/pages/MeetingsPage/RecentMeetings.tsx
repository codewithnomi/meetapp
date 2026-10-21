// "Recent meetings" on the Meetings screen (F03 design.md 2.2, AC-F03-42): past meetings the person
// took part in whose chat they may still read, each with Open chat. The chat opens read-only beside
// the list; organizers and co-organizers may still remove a message. F06 moves this into the library.
import type { RecentMeetingChats } from "@meetapp/contracts";
import { Button } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { usePastChat, useRecentMeetingChats } from "../../features/meetings/chat/index.ts";
import { ChatArea } from "../MeetingPage/index.ts";

export type PastMeeting = RecentMeetingChats["meetings"][number];

const day = (iso: string) => new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

export function RecentMeetings({ onOpen }: { onOpen: (meeting: PastMeeting) => void }) {
  const { t } = useTranslation();
  const recent = useRecentMeetingChats();
  const meetings = recent.data?.meetings ?? [];
  return (
    <section aria-labelledby="recent-meetings" className="flex flex-col gap-3">
      <h2 id="recent-meetings" className="m-0 text-[17px] leading-6 font-[650] text-ink">
        {t("meetings.recent.title")}
      </h2>
      {recent.isSuccess && meetings.length === 0 ? (
        <p className="m-0 text-[14px] text-ink-muted">{t("meetings.recent.empty")}</p>
      ) : null}
      {meetings.length > 0 ? (
        <ul className="m-0 flex list-none flex-col divide-y divide-line rounded-lg border border-line bg-surface p-0">
          {meetings.map((meeting) => (
            <li key={meeting.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[14px] font-[600] text-ink">{meeting.title}</span>
                <span className="text-[12px] text-ink-muted">
                  {t("meetings.recent.joined", { date: day(meeting.lastJoinedAt) })}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                aria-label={t("meetings.recent.openChatFor", { title: meeting.title })}
                onClick={() => onOpen(meeting)}
              >
                {t("meetings.recent.openChat")}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** A past meeting's chat beside the list, read-only (AC-F03-42). */
export function PastChat({
  meeting,
  onClose,
  onFailed,
}: {
  meeting: PastMeeting;
  onClose: () => void;
  onFailed: () => void;
}) {
  const chat = usePastChat(meeting.id);
  return (
    <aside className="flex w-90 shrink-0 flex-col border-l border-line">
      <ChatArea
        chat={chat}
        dropping={false}
        title={meeting.title}
        rights={{ moderate: meeting.organizer, createPoll: false, attach: false }}
        onClose={onClose}
        onFailed={onFailed}
      />
    </aside>
  );
}
