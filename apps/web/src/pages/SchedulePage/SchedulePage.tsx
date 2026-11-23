// SchedulePage (page): New meeting and Edit meeting, full page as in Teams (approved "Calendar: New
// meeting" screen; F13 AC-F13-07, 08, 10, 11, 14, 18, 19). Send checks every field first; moving a whole
// series asks before answers reset. Editing one meeting of a series changes only its time, title and notes.
import { REPEAT_KINDS, WEEKDAYS } from "@meetapp/contracts";
import { Button, DateTimeField, Dialog, Notice, RepeatPicker, ScheduleForm, Spinner } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import type { FormValues, Weekday } from "../../features/scheduling/index.ts";
import { WorkspaceShell, useCurrentWorkspace, type AppScreen } from "../../features/workspaces/index.ts";
import { InviteesField } from "./InviteesField.tsx";
import { useScheduleForm, type EditTarget, type FieldErrors } from "./use-schedule-form.ts";

export interface SchedulePageProps {
  onNavigate: (screen: AppScreen) => void;
  /** Back to the calendar (after Send or Cancel). */
  onDone: () => void;
  edit?: EditTarget | undefined;
  /** A range dragged in the calendar. */
  range?: { startsAt: Date; endsAt: Date } | undefined;
  now?: () => Date;
}

const zoneName = () => Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll("_", " ");

function Repeat({
  values,
  error,
  onChange,
}: {
  values: FormValues;
  error?: string | undefined;
  onChange: (r: FormValues["repeat"]) => void;
}) {
  const { t } = useTranslation();
  const dayName = (d: Weekday, style: "narrow" | "long") =>
    new Intl.DateTimeFormat(navigator.language, { weekday: style }).format(new Date(2026, 0, 5 + WEEKDAYS.indexOf(d)));
  return (
    <RepeatPicker
      id="repeat"
      label={t("schedule.repeat")}
      choices={REPEAT_KINDS.map((value) => ({ value, label: t(`schedule.repeatKinds.${value}`) }))}
      kind={values.repeat.kind}
      noneKind="none"
      weeklyKind="weekly"
      days={{
        label: t("schedule.repeatOn"),
        days: WEEKDAYS.map((value) => ({ value, short: dayName(value, "narrow"), full: dayName(value, "long") })),
        chosen: values.repeat.days,
      }}
      until={{ label: t("schedule.endRepeat"), hint: t("schedule.endRepeatHint"), value: values.repeat.until, error }}
      onChange={onChange}
    />
  );
}

function Fields({
  workspaceId,
  values,
  errors,
  set,
  occurrence,
}: {
  workspaceId: string;
  values: FormValues;
  errors: FieldErrors;
  set: (change: Partial<FormValues>) => void;
  occurrence: boolean;
}) {
  const { t } = useTranslation();
  const when = (which: "start" | "end") => (
    <DateTimeField
      id={which === "start" ? "starts" : "ends"}
      label={t(which === "start" ? "schedule.starts" : "schedule.ends")}
      timeLabel={t(which === "start" ? "schedule.startTime" : "schedule.endTime")}
      date={values[which].date}
      time={values[which].time}
      allDay={values.allDay}
      error={which === "start" ? errors.startsAt : errors.endsAt}
      onChange={(value) => set({ [which]: value })}
    />
  );
  return {
    people: occurrence ? (
      <Notice tone="neutral">{t("schedule.occurrenceNote")}</Notice>
    ) : (
      <InviteesField
        workspaceId={workspaceId}
        invitees={values.invitees}
        error={errors.invitees}
        onChange={(invitees) => set({ invitees })}
      />
    ),
    starts: when("start"),
    ends: when("end"),
    repeat: occurrence ? null : <Repeat values={values} error={errors.until} onChange={(repeat) => set({ repeat })} />,
  };
}

function MoveDialog({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("schedule.seriesMove.title")}
      description={t("schedule.seriesMove.body")}
      closeLabel={t("schedule.seriesMove.back")}
    >
      <div className="flex justify-end gap-2.5">
        <Button variant="secondary" onClick={onClose}>
          {t("schedule.seriesMove.back")}
        </Button>
        <Button onClick={onConfirm}>{t("schedule.seriesMove.confirm")}</Button>
      </div>
    </Dialog>
  );
}

function TheForm({
  form,
  values,
  heading,
  edit,
  workspaceId,
  onDone,
}: {
  form: ReturnType<typeof useScheduleForm>;
  values: FormValues;
  heading: string;
  edit: EditTarget | undefined;
  workspaceId: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const set = (change: Partial<FormValues>) => form.setValues({ ...values, ...change });
  return (
    <ScheduleForm
      heading={heading}
      cancel={{ label: t("schedule.cancel"), onClick: onDone }}
      submit={{
        label: t(edit ? "schedule.sendUpdate" : "schedule.send"),
        busyLabel: t("schedule.sending"),
        busy: form.busy,
        onSubmit: () => form.send(onDone),
      }}
      title={{
        label: t("schedule.title"),
        value: values.title,
        error: form.errors.title,
        onChange: (title) => set({ title }),
      }}
      {...Fields({ workspaceId, values, errors: form.errors, set, occurrence: edit?.scope === "occurrence" })}
      allDay={{ label: t("schedule.allDay"), checked: values.allDay, onChange: (allDay) => set({ allDay }) }}
      timeZoneNote={t("schedule.timeZone", { zone: zoneName() })}
      notes={{
        label: t("schedule.notes"),
        value: values.description,
        error: form.errors.description,
        onChange: (description) => set({ description }),
      }}
      error={form.refusal}
      footnote={t("schedule.footnote")}
    />
  );
}

export function SchedulePage({ onNavigate, onDone, edit, range, now = () => new Date() }: SchedulePageProps) {
  const { t } = useTranslation();
  const { current } = useCurrentWorkspace();
  const workspaceId = current?.id ?? "";
  const form = useScheduleForm(workspaceId, edit, { range, now });
  const { values } = form;
  const heading = !edit
    ? t("schedule.newHeading")
    : edit.scope === "occurrence"
      ? t("schedule.editOneHeading")
      : t("schedule.editHeading");
  return (
    <WorkspaceShell screen="calendar" onNavigate={onNavigate}>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {form.notFound ? (
          <Notice tone="danger" className="m-6">
            {t("schedule.errors.notFound")}
          </Notice>
        ) : null}
        {!values && !form.notFound ? <Spinner label={heading} className="m-6" /> : null}
        {values ? (
          <TheForm
            form={form}
            values={values}
            heading={heading}
            edit={edit}
            workspaceId={workspaceId}
            onDone={onDone}
          />
        ) : null}
        {form.confirmMove ? <MoveDialog onConfirm={() => form.send(onDone, true)} onClose={form.closeMove} /> : null}
      </main>
    </WorkspaceShell>
  );
}
