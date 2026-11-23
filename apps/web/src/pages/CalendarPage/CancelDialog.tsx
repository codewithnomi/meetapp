// Cancel meeting (F13 AC-F13-20): one meeting of a series or the whole series, with an optional message
// that goes into the cancellation email.
import { SCHEDULE_LIMITS } from "@meetapp/contracts";
import { Button, Dialog, Notice, SegmentedControl } from "@meetapp/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCancelSchedule, type CalendarOccurrence } from "../../features/scheduling/index.ts";
import type { Scope } from "./ScopeDialog.tsx";

function MessageField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const message = value;
  const setMessage = onChange;
  return (
    <>
      <label htmlFor="cancel-message" className="text-[13px] font-[550]">
        {t("schedule.cancelDialog.message")}
      </label>
      <textarea
        id="cancel-message"
        rows={3}
        maxLength={SCHEDULE_LIMITS.cancelMessage}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        className="rounded-md border border-line-strong bg-surface px-3 py-2 font-[inherit] text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      />
    </>
  );
}

function Buttons({ pending, onConfirm, onClose }: { pending: boolean; onConfirm: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end gap-2.5">
      <Button variant="secondary" onClick={onClose}>
        {t("schedule.cancelDialog.keep")}
      </Button>
      {pending ? (
        <Button variant="danger" loading loadingLabel={t("schedule.sending")}>
          {t("schedule.cancelDialog.confirm")}
        </Button>
      ) : (
        <Button variant="danger" onClick={onConfirm}>
          {t("schedule.cancelDialog.confirm")}
        </Button>
      )}
    </div>
  );
}

export function CancelDialog({
  occurrence,
  day,
  onDone,
  onClose,
}: {
  occurrence: CalendarOccurrence;
  /** "Wed 25 Nov". */
  day: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const cancel = useCancelSchedule(occurrence.meetingId);
  const [scope, setScope] = useState<Scope>(occurrence.repeats ? "occurrence" : "series");
  const [message, setMessage] = useState("");
  const confirm = () =>
    cancel.mutate(
      {
        scope,
        ...(scope === "occurrence" ? { originalStart: occurrence.originalStart } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      },
      { onSuccess: onDone },
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("schedule.cancelDialog.title", { title: occurrence.title })}
      description={t("schedule.cancelDialog.body")}
      closeLabel={t("schedule.cancelDialog.keep")}
    >
      {occurrence.repeats ? (
        <SegmentedControl
          label={t("schedule.cancelDialog.which")}
          options={[
            { value: "occurrence", label: t("schedule.cancelDialog.occurrence", { date: day }) },
            { value: "series", label: t("schedule.cancelDialog.series") },
          ]}
          value={scope}
          onChange={setScope}
        />
      ) : null}
      <MessageField value={message} onChange={setMessage} />
      {cancel.isError ? <Notice tone="danger">{t("schedule.cancelDialog.failed")}</Notice> : null}
      <Buttons pending={cancel.isPending} onConfirm={confirm} onClose={onClose} />
    </Dialog>
  );
}
