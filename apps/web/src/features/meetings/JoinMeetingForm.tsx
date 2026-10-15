// "Join a meeting" (approved canvas "Meetings", AC-F02-08): two tabs, Meeting ID (ID and passcode) and
// Link. A miss shows "We couldn't find that meeting. Check the link, or the ID and passcode." under the
// field and nothing more; an expired meeting says so. A found meeting goes to its pre-join.
import { Button, Icon, Input, SegmentedControl } from "@meetapp/ui";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { idAddress, linkAddress } from "./meeting-address.ts";
import { meetingErrorText } from "./meeting-errors.ts";
import { useFindMeeting, type MeetingFound } from "./meetings-api.ts";

type Way = "id" | "link";

function useErrorText(error: ReturnType<typeof useFindMeeting>["error"]): string | undefined {
  const { t } = useTranslation();
  if (!error) return undefined;
  const text = meetingErrorText(error.code, error.retryAfterSeconds);
  return t(text.key, text.values ?? {});
}

function JoinButton({ pending }: { pending: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5">
      <span aria-hidden="true" className="h-4.5" />
      {pending ? (
        <Button type="submit" loading loadingLabel={t("meetings.join.finding")}>
          {t("meetings.join.join")}
        </Button>
      ) : (
        <Button type="submit">{t("meetings.join.join")}</Button>
      )}
    </div>
  );
}

type Values = { link: string; meetingNumber: string; passcode: string };
type Set = (field: keyof Values) => (event: { target: { value: string } }) => void;

/** The fields of the chosen way: ID and passcode, or the link. A miss is shown under the first one. */
function Fields({ way, values, set, error }: { way: Way; values: Values; set: Set; error: string | undefined }) {
  const { t } = useTranslation();
  const errorProps = error ? { error } : {};
  if (way === "link")
    return (
      <Input
        id="meeting-link"
        className="min-w-0 flex-[1_1_360px]"
        label={t("meetings.join.link")}
        placeholder={t("meetings.join.linkPlaceholder")}
        autoComplete="off"
        {...errorProps}
        value={values.link}
        onChange={set("link")}
      />
    );
  return (
    <>
      <Input
        id="meeting-number"
        className="min-w-0 flex-[1_1_220px]"
        label={t("meetings.join.meetingId")}
        placeholder={t("meetings.join.meetingIdExample")}
        inputMode="numeric"
        autoComplete="off"
        {...(error ? errorProps : { hint: t("meetings.join.meetingIdHint") })}
        value={values.meetingNumber}
        onChange={set("meetingNumber")}
      />
      <Input
        id="meeting-passcode"
        className="min-w-0 flex-[1_1_160px]"
        label={t("meetings.join.passcode")}
        placeholder={t("meetings.join.passcodeExample")}
        autoComplete="off"
        hint={t("meetings.join.passcodeHint")}
        value={values.passcode}
        onChange={set("passcode")}
      />
    </>
  );
}

export function JoinMeetingForm({ onFound, note }: { onFound: (found: MeetingFound) => void; note?: string }) {
  const { t } = useTranslation();
  const [way, setWay] = useState<Way>("id");
  const [values, setValues] = useState<Values>({ link: "", meetingNumber: "", passcode: "" });
  const find = useFindMeeting();
  const error = useErrorText(find.error);
  const set: Set = (field) => (event) => setValues((old) => ({ ...old, [field]: event.target.value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const address = way === "link" ? linkAddress(values.link) : idAddress(values.meetingNumber, values.passcode);
    find.mutate(address, { onSuccess: onFound });
  };
  return (
    <section
      aria-labelledby="join-meeting-heading"
      className="flex max-w-190 flex-col gap-4 rounded-lg border border-line bg-surface p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon name="ticket" size={28} />
          <h2 id="join-meeting-heading" className="m-0 text-[17px] leading-6 font-[650]">
            {t("meetings.join.title")}
          </h2>
        </div>
        <SegmentedControl<Way>
          label={t("meetings.join.with")}
          value={way}
          options={[
            { value: "id", label: t("meetings.join.byId") },
            { value: "link", label: t("meetings.join.byLink") },
          ]}
          onChange={(next) => {
            setWay(next);
            find.reset();
          }}
        />
      </div>
      <form noValidate onSubmit={submit} className="flex flex-wrap items-start gap-3">
        <Fields way={way} values={values} set={set} error={error} />
        <JoinButton pending={find.isPending} />
      </form>
      {note ? <p className="m-0 text-[13px] text-ink-muted">{note}</p> : null}
    </section>
  );
}
