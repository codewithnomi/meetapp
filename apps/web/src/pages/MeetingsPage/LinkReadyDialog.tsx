// "Your meeting link is ready" (approved canvas, AC-F02-02): the link, meeting ID and passcode, each with
// Copy, a note on who waits in the lobby and when the link stops working, then Meeting options, Copy
// all details and Done. The app doesn't join the call. "Copied" is read out after each copy.
import { Button, Dialog } from "@meetapp/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { copyText, spacedMeetingNumber, type MeetingDetails } from "../../features/meetings/index.ts";

/** The "Get link" button; this dialog gives focus back to it (it was busy while the link was made). */
export const GET_LINK_ID = "get-meeting-link";

export interface LinkReadyDialogProps {
  meeting: MeetingDetails;
  workspaceName: string;
  onClose: () => void;
  onOptions: () => void;
}

function useCopy() {
  const { t } = useTranslation();
  const [status, setStatus] = useState("");
  const copy = (text: string, what: string) =>
    void copyText(text).then((ok) =>
      setStatus(ok ? t("meetings.ready.copied", { what }) : t("meetings.ready.copyFailed")),
    );
  return { status, copy };
}

/** One line of the details: the name, the value in the code font, and its Copy button. */
function CopyRow({
  term,
  shown,
  copyLabel,
  onCopy,
}: {
  term: string;
  shown: string;
  copyLabel: string;
  onCopy: () => void;
}) {
  return (
    <>
      <dt className="text-[13px] font-[550] text-ink-muted">{term}</dt>
      <dd className="m-0 font-mono text-[15px] font-semibold tracking-[0.04em]">{shown}</dd>
      <dd className="m-0">
        <Button variant="ghost" size="sm" icon="copy" onClick={onCopy}>
          {copyLabel}
        </Button>
      </dd>
    </>
  );
}

function Actions({
  onOptions,
  onCopyAll,
  onClose,
}: {
  onOptions: () => void;
  onCopyAll: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap justify-end gap-2.5">
      <Button variant="secondary" icon="sliders" onClick={onOptions}>
        {t("meetings.ready.options")}
      </Button>
      <Button variant="secondary" icon="copy" onClick={onCopyAll}>
        {t("meetings.ready.copyAll")}
      </Button>
      <Button onClick={onClose}>{t("meetings.ready.done")}</Button>
    </div>
  );
}

export function LinkReadyDialog({ meeting, workspaceName, onClose, onOptions }: LinkReadyDialogProps) {
  const { t } = useTranslation();
  const { status, copy } = useCopy();
  const number = spacedMeetingNumber(meeting.meetingNumber);
  const all = t("meetings.ready.allDetails", {
    title: meeting.title,
    link: meeting.link,
    id: number,
    passcode: meeting.passcode,
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("meetings.ready.title")}
      description={meeting.title}
      closeLabel={t("meetings.ready.close")}
      returnFocusId={GET_LINK_ID}
    >
      <div className="flex min-h-11 items-center gap-2.5 rounded-full bg-surface-sunken py-0 pr-2 pl-4.5">
        <span className="min-w-0 flex-1 truncate text-[14px]">{meeting.link}</span>
        <Button variant="ghost" size="sm" icon="copy" onClick={() => copy(meeting.link, t("meetings.ready.link"))}>
          {t("meetings.ready.copyLink")}
        </Button>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-3">
        <CopyRow
          term={t("meetings.ready.meetingId")}
          shown={number}
          copyLabel={t("meetings.ready.copyId")}
          onCopy={() => copy(meeting.meetingNumber, t("meetings.ready.meetingId"))}
        />
        <CopyRow
          term={t("meetings.ready.passcode")}
          shown={meeting.passcode}
          copyLabel={t("meetings.ready.copyPasscode")}
          onCopy={() => copy(meeting.passcode, t("meetings.ready.passcode"))}
        />
      </dl>
      <p className="m-0 text-[13px] leading-4.5 text-ink-muted">
        {t("meetings.ready.note", { workspace: workspaceName })}
      </p>
      <p role="status" className="m-0 min-h-5 text-[13px] text-ink-muted">
        {status}
      </p>
      <Actions onOptions={onOptions} onCopyAll={() => copy(all, t("meetings.ready.details"))} onClose={onClose} />
    </Dialog>
  );
}
