// MeetingPage (page): inside the meeting. For now it says the person is in and offers Leave; the call
// itself (video, sound, controls) arrives in the next step (F02 T14).
import { Button } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { leaveMeeting, useVisit } from "../../features/meetings/index.ts";

export function MeetingPage({ onLeft }: { onLeft: () => void }) {
  const { t } = useTranslation();
  const visit = useVisit((state) => state.visit);
  const end = useVisit((state) => state.end);
  const leave = () => void leaveMeeting(visit).then(() => (end(), onLeft()));
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-stage px-6 text-stage-ink">
      <h1 tabIndex={-1} className="m-0 text-[26px] leading-8 font-bold outline-none">
        {visit?.title ?? ""}
      </h1>
      <p role="status" className="m-0">
        {t("meetings.call.inside")}
      </p>
      <Button variant="danger" icon="leave" onClick={leave}>
        {t("meetings.lobby.leave")}
      </Button>
    </main>
  );
}
