// Group details (approved canvas F14Group, AC-F14-14–18): rename, the people with status and "(External)",
// Add people with the history choice, remove anyone, and Leave group (after a question).
import { Button, Dialog, GroupDetails, HistoryChoice, Notice, PeoplePicker, type History } from "@meetapp/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  addToGroup,
  findPeople,
  leaveGroup,
  removeFromGroup,
  renameGroup,
  useMembers,
  type ChatItem,
  type ChatMember,
  type FoundPeople,
} from "../../features/chats/index.ts";
import { useCurrentWorkspace } from "../../features/workspaces/index.ts";
import { LoadState } from "./LoadState.tsx";

type Person = FoundPeople["people"][number];

function useFound(query: string) {
  const { current } = useCurrentWorkspace();
  const [found, setFound] = useState<Person[]>([]);
  const search = (q: string) => {
    if (!q.trim() || !current) return setFound([]);
    void findPeople(current.id, q.trim()).then((answer) => setFound(answer.people));
  };
  return { found, search, query };
}

/** What Add people holds: the chosen people, the history choice; Add sends them (AC-F14-17). */
function useAddPeople(item: ChatItem, onClose: () => void) {
  const queries = useQueryClient();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Person[]>([]);
  const [history, setHistory] = useState<History>({ from: "all" });
  const [failed, setFailed] = useState(false);
  const { found, search } = useFound(query);
  const badDays = history.from === "days" && !(history.days >= 1 && history.days <= 365);
  const add = () =>
    void addToGroup(
      item.id,
      picked.map((p) => p.userId),
      history,
    )
      .then(() => queries.invalidateQueries({ queryKey: ["chats"] }))
      .then(onClose)
      .catch(() => setFailed(true));
  const typed = (q: string) => {
    setQuery(q);
    search(q);
  };
  const pick = (id: string) => {
    const person = found.find((p) => p.userId === id);
    if (person) setPicked([...picked, person]);
    setQuery("");
  };
  const remove = (id: string) => setPicked(picked.filter((p) => p.userId !== id));
  return { query, typed, picked, pick, remove, found, history, setHistory, badDays, add, failed };
}

function historyLabels(t: TFunction) {
  return {
    none: t("chats.group.history.none"),
    days: t("chats.group.history.days"),
    all: t("chats.group.history.all"),
    daysField: t("chats.group.history.daysField"),
  };
}

type Adding = ReturnType<typeof useAddPeople>;

/** Add people opens with the cursor in its To: field; closing gives focus back to the button. */
const ADD_FIELD = "add-people-to";

/** Whom to add: chips and suggestions ("(External)" for people outside the workspace). */
function AddPicker({ adding }: { adding: Adding }) {
  const { t } = useTranslation();
  return (
    <PeoplePicker
      inputId={ADD_FIELD}
      label={t("chats.new.to")}
      picked={adding.picked.map((p) => ({
        id: p.userId,
        name: p.name,
        photoUrl: p.photoUrl,
        removeLabel: t("chats.new.remove", { name: p.name }),
      }))}
      query={adding.query}
      onQueryChange={adding.typed}
      suggestions={adding.found
        .filter((p) => !adding.picked.some((x) => x.userId === p.userId))
        .map((p) => ({
          id: p.userId,
          name: p.name,
          photoUrl: p.photoUrl,
          externalLabel: p.external ? t("chats.new.external") : undefined,
        }))}
      suggestionsLabel={t("chats.new.suggestions")}
      onPick={adding.pick}
      onRemove={adding.remove}
    />
  );
}

function AddDialog({ item, open, onClose }: { item: ChatItem; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const adding = useAddPeople(item, onClose);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t("chats.group.addTitle", { group: item.title })}
      description={t("chats.group.addHint")}
      closeLabel={t("chats.group.cancel")}
      initialFocusId={ADD_FIELD}
    >
      <div className="flex flex-col gap-4">
        <AddPicker adding={adding} />
        <HistoryChoice
          legend={t("chats.group.historyLegend")}
          labels={historyLabels(t)}
          value={adding.history}
          onChange={adding.setHistory}
          daysError={adding.badDays ? t("chats.group.history.daysError") : undefined}
        />
        {adding.failed ? <Notice tone="danger">{t("chats.failed")}</Notice> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("chats.group.cancel")}
          </Button>
          <Button disabled={adding.picked.length === 0 || adding.badDays} onClick={adding.add}>
            {t("chats.group.addButton")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function personOf(t: TFunction, member: ChatMember, userId: string) {
  const you = member.userId === userId;
  const name = you
    ? t("chats.group.you", { name: member.name })
    : member.pending
      ? t("chats.group.pending", { name: member.name })
      : member.name;
  return {
    id: member.userId,
    name,
    photoUrl: member.photoUrl,
    status: member.status ? { value: member.status, label: t(`chats.status.${member.status}`) } : null,
    externalLabel: member.external ? t("chats.new.external") : undefined,
    removeLabel: you ? undefined : t("chats.group.remove", { name: member.name }),
  };
}

/** "Leave this group?" with Cancel and Leave group (approved canvas F14Group). */
function LeaveDialog({ open, onClose, onLeave }: { open: boolean; onClose: () => void; onLeave: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={t("chats.group.leaveTitle")}
      description={t("chats.group.leaveHint")}
      closeLabel={t("chats.group.cancel")}
    >
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t("chats.group.cancel")}
        </Button>
        <Button variant="danger" onClick={onLeave}>
          {t("chats.group.leave")}
        </Button>
      </div>
    </Dialog>
  );
}

/** Rename, remove and leave, each refreshing the list; a failure is shown above the details. */
function useGroupActions(item: ChatItem, onLeft: () => void) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const [failed, setFailed] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const run = (work: Promise<unknown>, then?: () => void) =>
    void work
      .then(() => queries.invalidateQueries({ queryKey: ["chats"] }))
      .then(then)
      .catch(() => setFailed(true));
  return {
    failed,
    nameError,
    rename: (name: string) => {
      if (name.length < 1 || name.length > 80) return setNameError(t("chats.group.nameError"));
      setNameError(undefined);
      run(renameGroup(item.id, name));
    },
    remove: (id: string) => run(removeFromGroup(item.id, id)),
    leave: () => run(leaveGroup(item.id), onLeft),
  };
}

export function GroupPane({
  item,
  userId,
  onClose,
  onLeft,
}: {
  item: ChatItem;
  userId: string;
  onClose: () => void;
  onLeft: () => void;
}) {
  const { t } = useTranslation();
  const asked = useMembers(item.id);
  const members = asked.data?.people ?? [];
  const [adding, setAdding] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const act = useGroupActions(item, onLeft);
  return (
    <main className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-6">
      {act.failed ? <Notice tone="danger">{t("chats.failed")}</Notice> : null}
      <LoadState query={asked} loadingLabel={t("chats.load.members")} />
      <GroupDetails
        title={item.title}
        closeLabel={t("chats.group.close")}
        onClose={onClose}
        nameLabel={t("chats.group.name")}
        name={item.title}
        nameError={act.nameError}
        onRename={act.rename}
        peopleHeading={t("chats.group.people", { count: members.length })}
        addLabel={t("chats.group.add")}
        onAdd={() => setAdding(true)}
        people={members.map((member) => personOf(t, member, userId))}
        onRemove={act.remove}
        leaveLabel={t("chats.group.leave")}
        onLeave={() => setLeaving(true)}
      />
      <AddDialog item={item} open={adding} onClose={() => setAdding(false)} />
      <LeaveDialog open={leaving} onClose={() => setLeaving(false)} onLeave={act.leave} />
    </main>
  );
}
