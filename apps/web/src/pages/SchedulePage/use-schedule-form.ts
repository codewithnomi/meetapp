// The New meeting / Edit meeting form's state (F13 AC-F13-07, 10, 14, 18, 19): starting values, field
// errors on Send (focus goes to the first, nothing is sent), the warning before a series moves in time,
// and the request. A refusal keeps everything as typed.
import type { ScheduleBody } from "@meetapp/contracts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  blankForm,
  checkSchedule,
  fromDetails,
  movesTime,
  refusalText,
  toBody,
  useScheduleDetails,
  useScheduleMeeting,
  useUpdateSchedule,
  type FormValues,
  type ScheduleField,
  type ScheduleDetails,
  type ScheduleUpdate,
} from "../../features/scheduling/index.ts";

export interface EditTarget {
  meetingId: string;
  scope: "series" | "occurrence";
  /** The occurrence being edited. */
  occurrence?: { originalStart: string; startsAt: string; endsAt: string } | undefined;
}

export type FieldErrors = Partial<Record<ScheduleField | "until", string>>;

const FIELD_IDS: Record<ScheduleField | "until", string> = {
  title: "schedule-title",
  invitees: "schedule-people",
  startsAt: "starts-date",
  endsAt: "ends-date",
  until: "repeat-until",
  description: "schedule-notes",
};
const ORDER = Object.keys(FIELD_IDS) as (ScheduleField | "until")[];

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function useErrors(now: () => Date) {
  const { t } = useTranslation();
  return (values: FormValues): FieldErrors => {
    const found: FieldErrors = {};
    const { errors } = checkSchedule(toBody(values, timeZone()), now());
    for (const [field, code] of Object.entries(errors) as [ScheduleField, string][]) {
      found[field] = t(`schedule.fieldErrors.${field}.${code}` as never);
    }
    if (values.repeat.kind !== "none" && values.repeat.until && values.repeat.until < values.start.date)
      found.until = t("schedule.fieldErrors.until");
    return found;
  };
}

/** Editing: the form fills once the meeting has loaded. */
function useFillFromMeeting(
  edit: EditTarget | undefined,
  details: ScheduleDetails | undefined,
  values: FormValues | undefined,
  fill: (values: FormValues) => void,
) {
  useEffect(() => {
    if (edit && details && !values) fill(fromDetails(details, edit.occurrence));
  }, [edit, details, values, fill]);
}

function focusFirst(errors: FieldErrors) {
  const first = ORDER.find((field) => errors[field]);
  if (first) document.getElementById(FIELD_IDS[first])?.focus();
}

/** What an edit sends: the whole series, or only the fields one meeting can change (AC-F13-18). */
function changeOf(body: ScheduleBody, edit: EditTarget): ScheduleUpdate {
  if (edit.scope === "series") return { ...body, scope: "series" };
  const { title, startsAt, endsAt, allDay, description } = body;
  return {
    title,
    startsAt,
    endsAt,
    allDay,
    description,
    scope: "occurrence",
    originalStart: edit.occurrence?.originalStart ?? "",
  };
}

export function useScheduleForm(
  workspaceId: string,
  edit: EditTarget | undefined,
  start: { range?: { startsAt: Date; endsAt: Date } | undefined; now: () => Date },
) {
  const { t } = useTranslation();
  const details = useScheduleDetails(edit?.meetingId);
  const [values, setValues] = useState<FormValues | undefined>(() =>
    edit ? undefined : blankForm(start.range, start.now()),
  );
  const [original, setOriginal] = useState<FormValues>();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirmMove, setConfirmMove] = useState(false);
  const create = useScheduleMeeting(workspaceId);
  const update = useUpdateSchedule(edit?.meetingId ?? "");
  const check = useErrors(start.now);
  const sendBody = (body: ScheduleBody, onDone: () => void) => {
    if (!edit) return create.mutate(body, { onSuccess: onDone });
    update.mutate(changeOf(body, edit), { onSuccess: onDone });
  };
  useFillFromMeeting(edit, details.data, values, (filled) => (setValues(filled), setOriginal(filled)));
  const send = (onDone: () => void, confirmed = false) => {
    if (!values) return;
    const found = check(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return focusFirst(found);
    if (edit?.scope === "series" && original && movesTime(original, values) && !confirmed) return setConfirmMove(true);
    setConfirmMove(false);
    sendBody(toBody(values, timeZone()), onDone);
  };
  const failure = create.error ?? update.error;
  const refusal = failure ? refusalText(failure) : undefined;
  return {
    values,
    setValues,
    errors,
    send,
    busy: create.isPending || update.isPending,
    confirmMove,
    closeMove: () => setConfirmMove(false),
    notFound: details.isError,
    refusal: refusal
      ? t(refusal.key as never, refusal.minutes === undefined ? {} : { count: refusal.minutes })
      : undefined,
  };
}
