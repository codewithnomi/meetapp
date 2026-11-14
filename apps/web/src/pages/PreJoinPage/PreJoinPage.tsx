// PreJoinPage (page): the step before joining (approved canvases "Pre-join" and "Pre-join as a
// guest", AC-F02-09, 10, 11): the own camera and sound on the left; on the right the meeting's title,
// whether the person goes straight in or waits in the lobby, for guests their name (1–60 characters)
// and the Terms sentence as plain text (D051), then Join now and Cancel.
import { Button, Input, Notice } from "@meetapp/ui";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  meetingErrorText,
  useJoinMeeting,
  usePreJoinDevices,
  type Joined,
  type PreJoinState,
} from "../../features/meetings/index.ts";
import { leaveCallAndRun } from "../../features/call-windows/index.ts";
import { DevicesSection } from "./DevicesSection.tsx";

export interface PreJoinPageProps {
  meeting: PreJoinState | undefined;
  /** The signed-in person's name; guests type theirs. */
  userName: string | undefined;
  onCancel: () => void;
  onJoined: (joined: Joined) => void;
  /** F17: the call the person is in now; joining leaves it (AC-F17-11, 12). */
  inCall?: string | undefined;
}

const MAX_NAME = 60;

/** Why joining failed; when MeetApp can't be reached, with Retry (AC-F02-46). */
function JoinError({ join, onRetry }: { join: ReturnType<typeof useJoinMeeting>; onRetry: () => void }) {
  const { t } = useTranslation();
  if (!join.error) return null;
  const text = meetingErrorText(join.error.code, join.error.retryAfterSeconds);
  const retry =
    join.error.code === "NETWORK_ERROR" ? { action: { label: t("meetings.call.retry"), onClick: onRetry } } : {};
  return (
    <Notice tone="danger" {...retry}>
      {t(text.key, text.values ?? {})}
    </Notice>
  );
}

function JoinButtons({ pending, onCancel, inCall }: { pending: boolean; onCancel: () => void; inCall: boolean }) {
  const { t } = useTranslation();
  const join = t(inCall ? "calls.leaveFirst.leaveJoin" : "meetings.preJoin.join");
  return (
    <div className="flex flex-wrap gap-2.5">
      {pending ? (
        <Button type="submit" size="lg" loading loadingLabel={t("meetings.preJoin.joining")}>
          {join}
        </Button>
      ) : (
        <Button type="submit" size="lg">
          {join}
        </Button>
      )}
      <Button variant="ghost" size="lg" onClick={onCancel}>
        {t("meetings.preJoin.cancel")}
      </Button>
    </div>
  );
}

/** Joining; during another call it leaves that one first (F17, AC-F17-12). */
function useJoinSubmit({ meeting, userName, onJoined, inCall }: PreJoinPageProps & { meeting: PreJoinState }) {
  const { t } = useTranslation();
  const join = useJoinMeeting();
  const [leaving, setLeaving] = useState<"no" | "yes" | "failed">("no");
  const [guestName, setGuestName] = useState("");
  const [nameError, setNameError] = useState<string>();
  const guest = userName === undefined;
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    // Enter pressed twice joins once (one attendance, one ticket).
    if (join.isPending) return;
    const name = guestName.trim();
    if (guest && (name.length < 1 || name.length > MAX_NAME)) return setNameError(t("meetings.preJoin.nameRule"));
    setNameError(undefined);
    const joinNow = () =>
      join.mutate(
        { lookupToken: meeting.lookupToken, address: meeting.address, ...(guest ? { guestName: name } : {}) },
        { onSuccess: onJoined },
      );
    if (!inCall) return joinNow();
    // F17: leave the current call first, then join (AC-F17-12).
    setLeaving("yes");
    void leaveCallAndRun(joinNow).then((left) => setLeaving(left ? "no" : "failed"));
  };
  return { join, leaving, guest, guestName, setGuestName, nameError, submit };
}

function JoinSection(props: PreJoinPageProps & { meeting: PreJoinState }) {
  const { meeting, onCancel, inCall } = props;
  const { t } = useTranslation();
  const { join, leaving, guest, guestName, setGuestName, nameError, submit } = useJoinSubmit(props);
  return (
    <form
      noValidate
      onSubmit={submit}
      aria-label={t("meetings.preJoin.join")}
      className="flex max-w-95 min-w-0 flex-[1_1_320px] flex-col gap-5"
    >
      <h1 tabIndex={-1} className="m-0 text-[26px] leading-8 font-bold tracking-[-0.01em] outline-none">
        {meeting.title}
      </h1>
      <p className="m-0 text-[14px] leading-5 text-ink-muted">
        {meeting.group === "member" ? t("meetings.preJoin.straightIn") : t("meetings.preJoin.lobby")}
      </p>
      {guest ? (
        <Input
          id="guest-name"
          label={t("meetings.preJoin.yourName")}
          autoComplete="name"
          maxLength={200}
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          {...(nameError ? { error: nameError } : {})}
        />
      ) : null}
      {inCall ? (
        <Notice tone="neutral" icon="phone">
          {t("calls.leaveFirst.join", { title: inCall })}
        </Notice>
      ) : null}
      {leaving === "failed" ? <Notice tone="danger">{t("calls.leaveFirst.failed")}</Notice> : null}
      <JoinError join={join} onRetry={() => void submit()} />
      <JoinButtons pending={join.isPending || leaving === "yes"} onCancel={onCancel} inCall={inCall !== undefined} />
      {guest ? <p className="m-0 text-[13px] text-ink-muted">{t("meetings.preJoin.terms")}</p> : null}
    </form>
  );
}

export function PreJoinPage(props: PreJoinPageProps) {
  const { t } = useTranslation();
  const devices = usePreJoinDevices();
  const { meeting, userName, onCancel } = props;
  return (
    <main className="flex min-h-screen flex-col gap-8 bg-bg px-6 py-8 text-ink sm:px-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <span className="text-[20px] font-bold">{t("auth.brand")}</span>
        <span className="text-[13px] text-ink-muted">
          {userName ? t("meetings.preJoin.signedInAs", { name: userName }) : t("meetings.preJoin.asGuest")}
        </span>
      </header>
      {meeting ? (
        <div className="flex flex-1 flex-wrap items-center justify-center gap-12">
          <DevicesSection
            devices={devices}
            name={userName ?? t("meetings.preJoin.you")}
            inCall={props.inCall !== undefined}
          />
          <JoinSection {...props} meeting={meeting} />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <h1 className="m-0 text-title">{t("meetings.preJoin.missing")}</h1>
          <Button variant="ghost" onClick={onCancel}>
            {t("meetings.preJoin.cancel")}
          </Button>
        </div>
      )}
    </main>
  );
}
