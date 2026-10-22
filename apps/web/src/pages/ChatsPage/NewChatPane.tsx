// New chat (approved canvas F14NewChat, AC-F14-07–09, 15): "To:" with chips and suggestions from the
// workspace's members as typed; an exact email shows that one account ("(External)" when outside the
// workspace) or offers an invitation; one person opens their chat, two or more start a group with an
// optional name.
import { Button, Input, Notice, PeoplePicker, type PeoplePickerProps } from "@meetapp/ui";
import type { TFunction } from "i18next";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { findPeople, inviteToMeetApp, startChat, type FoundPeople } from "../../features/chats/index.ts";
import { useCurrentWorkspace, useInvite } from "../../features/workspaces/index.ts";

type Person = FoundPeople["people"][number];

function usePeople(workspaceId: string, query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["chat-people", workspaceId, q],
    queryFn: () => findPeople(workspaceId, q),
    enabled: q.length > 0,
    staleTime: 10_000,
  });
}

/** An email nobody uses: F01's invitation in a team workspace, "Join me on MeetApp" in Personal (AC-F14-08). */
function useInvitation(workspaceId: string, personal: boolean) {
  const team = useInvite(workspaceId);
  const [sent, setSent] = useState<string>();
  const invite = (email: string) => {
    const done = () => setSent(email);
    if (personal) void inviteToMeetApp(email).then(done);
    else team.mutate({ emails: [email], role: "member" }, { onSuccess: done });
  };
  return { sent, invite };
}

/** What New chat holds: the typed words, the chosen people, the group name; Start opens the chat. */
function useNewChat(onStarted: (id: string) => void) {
  const { current } = useCurrentWorkspace();
  const workspaceId = current?.id ?? "";
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Person[]>([]);
  const [groupName, setGroupName] = useState("");
  const [failed, setFailed] = useState(false);
  const found = usePeople(workspaceId, query).data;
  const invitation = useInvitation(workspaceId, current?.kind === "personal");
  const suggestions = (found?.people ?? []).filter((person) => !picked.some((p) => p.userId === person.userId));
  const start = () =>
    void startChat(
      workspaceId,
      picked.map((p) => p.userId),
      picked.length > 1 ? groupName : undefined,
    )
      .then((made) => onStarted(made.id))
      .catch(() => setFailed(true));
  const pick = (id: string) => {
    const person = suggestions.find((p) => p.userId === id);
    if (person) setPicked([...picked, person]);
    setQuery("");
  };
  const remove = (id: string) => setPicked(picked.filter((p) => p.userId !== id));
  return {
    query,
    setQuery,
    picked,
    groupName,
    setGroupName,
    failed,
    found,
    invitation,
    suggestions,
    start,
    pick,
    remove,
  };
}

type NewChat = ReturnType<typeof useNewChat>;

/** The To: field's words, chips, suggestions and the "no account" note (AC-F14-07, 08, 26). */
function pickerProps(t: TFunction, chat: NewChat): PeoplePickerProps {
  const status = (person: Person) => (person.status ? t(`chats.status.${person.status}`) : undefined);
  const email = chat.query.trim();
  return {
    label: t("chats.new.to"),
    hint: t("chats.new.hint"),
    picked: chat.picked.map((person) => ({
      id: person.userId,
      name: person.name,
      photoUrl: person.photoUrl,
      removeLabel: t("chats.new.remove", { name: person.name }),
    })),
    query: chat.query,
    onQueryChange: chat.setQuery,
    suggestions: chat.suggestions.map((person) => ({
      id: person.userId,
      name: person.name,
      photoUrl: person.photoUrl,
      status: person.status ? { value: person.status, label: status(person) ?? "" } : null,
      detail: person.external ? t("chats.new.externalDetail") : status(person),
      externalLabel: person.external ? t("chats.new.external") : undefined,
    })),
    suggestionsLabel: t("chats.new.suggestions"),
    onPick: chat.pick,
    onRemove: chat.remove,
    noAccount: chat.found?.noAccount
      ? {
          email,
          message: t("chats.new.noAccount"),
          inviteLabel: t("chats.new.invite", { email }),
          onInvite: () => chat.invitation.invite(email),
        }
      : undefined,
  };
}

export function NewChatPane({ onStarted, onCancel }: { onStarted: (id: string) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const nameId = useId();
  const chat = useNewChat(onStarted);
  return (
    <main className="flex h-full max-w-160 flex-col gap-3.5 p-6 text-ink">
      <h1 tabIndex={-1} className="m-0 text-[22px] leading-7 font-bold outline-none">
        {t("chats.new.title")}
      </h1>
      <PeoplePicker {...pickerProps(t, chat)} />
      {chat.invitation.sent ? (
        <Notice tone="success">{t("chats.new.invited", { email: chat.invitation.sent })}</Notice>
      ) : null}
      {chat.picked.length > 1 ? (
        <Input
          id={nameId}
          label={t("chats.new.groupName")}
          hint={t("chats.new.groupNameHint")}
          value={chat.groupName}
          maxLength={80}
          onChange={(event) => chat.setGroupName(event.target.value)}
        />
      ) : null}
      {chat.failed ? <Notice tone="danger">{t("chats.failed")}</Notice> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {t("chats.new.cancel")}
        </Button>
        <Button disabled={chat.picked.length === 0} onClick={chat.start}>
          {t("chats.new.start")}
        </Button>
      </div>
    </main>
  );
}
