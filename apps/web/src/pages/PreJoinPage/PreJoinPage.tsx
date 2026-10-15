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
import { DevicesSection } from "./DevicesSection.tsx";

export interface PreJoinPageProps {
  meeting: PreJoinState | undefined;
  /** The signed-in person's name; guests type theirs. */
  userName: string | undefined;
  onCancel: () => void;
  onJoined: (joined: Joined) => void;
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

function JoinButtons({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2.5">
      {pending ? (
        <Button type="submit" size="lg" loading loadingLabel={t("meetings.preJoin.joining")}>
          {t("meetings.preJoin.join")}
        </Button>
      ) : (
        <Button type="submit" size="lg">
          {t("meetings.preJoin.join")}
        </Button>
      )}
      <Button variant="ghost" size="lg" onClick={onCancel}>
        {t("meetings.preJoin.cancel")}
      </Button>
    </div>
  );
}

function JoinSection({ meeting, userName, onCancel, onJoined }: PreJoinPageProps & { meeting: PreJoinState }) {
  const { t } = useTranslation();
  const join = useJoinMeeting();
  const [guestName, setGuestName] = useState("");
  const [nameError, setNameError] = useState<string>();
  const guest = userName === undefined;
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const name = guestName.trim();
    if (guest && (name.length < 1 || name.length > MAX_NAME)) return setNameError(t("meetings.preJoin.nameRule"));
    setNameError(undefined);
    join.mutate({ lookupToken: meeting.lookupToken, ...(guest ? { guestName: name } : {}) }, { onSuccess: onJoined });
  };
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
      <JoinError join={join} onRetry={() => void submit()} />
      <JoinButtons pending={join.isPending} onCancel={onCancel} />
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
          <DevicesSection devices={devices} name={userName ?? t("meetings.preJoin.you")} />
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
