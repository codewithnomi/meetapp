// MeetingsPage (page): the approved "Meetings" canvas (AC-F02-01, 02, 08). Meet now makes a meeting and
// opens its pre-join; Get a meeting link makes one (with an optional title) and shows the link-ready
// dialog without joining; Join a meeting finds one by ID and passcode or by link. Meetings belong to
// the open workspace. Each press of Meet now or Get link uses one Idempotency-Key, so a double click
// makes one meeting (AC-F02-46).
import { Button, Icon, Input } from "@meetapp/ui";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ActionErrorNotice } from "../../features/auth/index.ts";
import {
  JoinMeetingForm,
  MeetingOptionsDialog,
  useCreateMeeting,
  type MeetingCreated,
  type PreJoinState,
} from "../../features/meetings/index.ts";
import {
  WorkspaceShell,
  useCurrentWorkspace,
  useWorkspaceName,
  type AppScreen,
} from "../../features/workspaces/index.ts";
import { GET_LINK_ID, LinkReadyDialog } from "./LinkReadyDialog.tsx";

export interface MeetingsPageProps {
  onNavigate: (screen: AppScreen) => void;
  onPreJoin: (state: PreJoinState) => void;
}

const newKey = () => crypto.randomUUID();

/** A big button that waits (and can't be pressed again) while its meeting is being made. */
function MakeButton({
  id,
  pending,
  label,
  pendingLabel,
  type = "button",
  onClick,
}: {
  id?: string;
  pending: boolean;
  label: string;
  pendingLabel: string;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  if (pending)
    return (
      <Button
        id={id}
        type={type}
        variant="secondary"
        size="lg"
        className="self-start"
        loading
        loadingLabel={pendingLabel}
      >
        {label}
      </Button>
    );
  return (
    <Button id={id} type={type} variant="secondary" size="lg" className="self-start" {...(onClick ? { onClick } : {})}>
      {label}
    </Button>
  );
}

function MeetNowCard({ workspaceId, onPreJoin }: { workspaceId: string; onPreJoin: MeetingsPageProps["onPreJoin"] }) {
  const { t } = useTranslation();
  const create = useCreateMeeting(workspaceId);
  const [key, setKey] = useState(newKey);
  const start = () =>
    create.mutate(
      { kind: "meet_now", key },
      {
        onSuccess: (meeting) => {
          setKey(newKey());
          onPreJoin({ title: meeting.title, lookupToken: meeting.lookupToken, group: "member" });
        },
      },
    );
  return (
    <div className="flex flex-col gap-4 rounded-lg bg-accent p-6 text-on-accent">
      <Icon name="camera" size={28} />
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[17px] leading-6 font-[650]">{t("meetings.start.meetNow")}</h2>
        <span className="text-[13px] leading-4.5">{t("meetings.start.meetNowText")}</span>
      </div>
      <ActionErrorNotice error={create.error} onRetry={start} />
      <MakeButton
        pending={create.isPending}
        label={t("meetings.start.meetNow")}
        pendingLabel={t("meetings.start.starting")}
        onClick={start}
      />
    </div>
  );
}

function GetLinkCard({ workspaceId, onCreated }: { workspaceId: string; onCreated: (m: MeetingCreated) => void }) {
  const { t } = useTranslation();
  const create = useCreateMeeting(workspaceId);
  const [title, setTitle] = useState("");
  const [key, setKey] = useState(newKey);
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    create.mutate(
      { kind: "link", title: title.trim(), key },
      {
        onSuccess: (meeting) => {
          setKey(newKey());
          setTitle("");
          onCreated(meeting);
        },
      },
    );
  };
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
      <Icon name="link" size={28} />
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[17px] leading-6 font-[650]">{t("meetings.start.getLink")}</h2>
        <span className="text-[13px] leading-4.5 text-ink-muted">{t("meetings.start.getLinkText")}</span>
      </div>
      <Input
        id="link-title"
        label={t("meetings.start.titleLabel")}
        maxLength={100}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <ActionErrorNotice error={create.error} onRetry={() => submit()} />
      <MakeButton
        id={GET_LINK_ID}
        type="submit"
        pending={create.isPending}
        label={t("meetings.start.getLinkButton")}
        pendingLabel={t("meetings.start.making")}
      />
    </form>
  );
}

export function MeetingsPage({ onNavigate, onPreJoin }: MeetingsPageProps) {
  const { t } = useTranslation();
  const { current } = useCurrentWorkspace();
  const nameOf = useWorkspaceName();
  const [ready, setReady] = useState<MeetingCreated>();
  const [optionsFor, setOptionsFor] = useState<string>();
  const workspaceName = current ? nameOf(current) : "";
  return (
    <WorkspaceShell screen="meetings" onNavigate={onNavigate}>
      <main className="flex max-w-260 flex-col gap-8 px-6 py-10 sm:px-12">
        <header className="flex flex-col gap-1">
          <h1 tabIndex={-1} className="m-0 text-title text-ink outline-none">
            {t("meetings.title")}
          </h1>
          <p className="m-0 text-ink-muted">{t("meetings.subtitle", { workspace: workspaceName })}</p>
        </header>
        {current ? (
          <section
            aria-label={t("meetings.start.label")}
            className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4"
          >
            <MeetNowCard workspaceId={current.id} onPreJoin={onPreJoin} />
            <GetLinkCard workspaceId={current.id} onCreated={setReady} />
          </section>
        ) : null}
        <JoinMeetingForm onFound={onPreJoin} note={t("meetings.join.guestNote")} />
      </main>
      {ready ? (
        <LinkReadyDialog
          meeting={ready}
          workspaceName={workspaceName}
          onClose={() => setReady(undefined)}
          onOptions={() => {
            setOptionsFor(ready.id);
            setReady(undefined);
          }}
        />
      ) : null}
      {optionsFor ? (
        <MeetingOptionsDialog meetingId={optionsFor} open onOpenChange={(open) => !open && setOptionsFor(undefined)} />
      ) : null}
    </WorkspaceShell>
  );
}
