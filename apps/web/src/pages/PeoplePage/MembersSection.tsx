// "Everyone" on the People screen (AC-F01-21, 22, 23): a search box and the member table. Each row's
// menu holds only what the viewer may do; removing, handing over and leaving ask first. After leaving,
// the app opens Personal.
import type { MembersResponse } from "@meetapp/contracts";
import { Input, MemberRow } from "@meetapp/ui";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActionErrorNotice } from "../../features/auth/index.ts";
import { formatDate, useMemberChange, type MemberChange } from "../../features/workspaces/index.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { actionsFor, NEEDS_CONFIRM, type ActionKind } from "./member-actions.ts";

type Member = MembersResponse["members"][number];

export interface MembersSectionProps {
  workspace: { id: string; name: string };
  data: MembersResponse;
  myId: string | undefined;
  onLeft: () => void;
}

interface Pending {
  kind: ActionKind;
  member: Member;
}

const changeOf = ({ kind, member }: Pending): MemberChange =>
  kind === "leave" ? { kind } : { kind, userId: member.userId };

function useConfirmText(pending: Pending | undefined, workspace: string) {
  const { t } = useTranslation();
  if (!pending) return { title: "", text: "", confirmLabel: "" };
  const values = { name: pending.member.name, workspace };
  const kind = pending.kind as "remove" | "transfer" | "leave";
  return {
    title: t(`workspaces.people.confirm.${kind}Title`, values),
    text: t(`workspaces.people.confirm.${kind}Text`, values),
    confirmLabel: t(`workspaces.people.confirm.${kind}Button`),
  };
}

function MembersTable({ members, rowFor }: { members: Member[]; rowFor: (member: Member) => ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-160 border-collapse text-[14px]">
        <thead>
          <tr className="text-left text-[12px] text-ink-muted">
            <th scope="col" className="px-5 py-3 font-semibold">
              {t("workspaces.people.columns.name")}
            </th>
            <th scope="col" className="px-3 py-3 font-semibold">
              {t("workspaces.people.columns.role")}
            </th>
            <th scope="col" className="px-3 py-3 font-semibold">
              {t("workspaces.people.columns.joined")}
            </th>
            <th scope="col" className="px-5 py-3">
              <span className="sr-only">{t("workspaces.people.columns.actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>{members.map(rowFor)}</tbody>
      </table>
    </div>
  );
}

/** The change being asked about (or sent), and how a menu choice is handled. */
function useMemberActions(workspaceId: string, onLeft: () => void) {
  const change = useMemberChange(workspaceId);
  const [pending, setPending] = useState<Pending>();
  const run = (next: Pending) =>
    change.mutate(changeOf(next), {
      onSuccess: () => {
        setPending(undefined);
        if (next.kind === "leave") onLeft();
      },
    });
  const choose = (next: Pending) => {
    change.reset();
    if (NEEDS_CONFIRM.has(next.kind)) setPending(next);
    else run(next);
  };
  return { change, pending, setPending, run, choose };
}

interface RowProps {
  member: Member;
  kinds: ActionKind[];
  isMe: boolean;
  onChoose: (next: Pending) => void;
}

function Row({ member, kinds, isMe, onChoose }: RowProps) {
  const { t, i18n } = useTranslation();
  return (
    <MemberRow
      name={member.name}
      email={member.email}
      photoUrl={member.photoUrl}
      roleLabel={t(`workspaces.roles.${member.role}`)}
      owner={member.role === "owner"}
      joined={formatDate(member.joinedAt, i18n.language)}
      youLabel={isMe ? t("workspaces.people.you") : undefined}
      actionsLabel={t("workspaces.people.actionsFor", { name: member.name })}
      actions={kinds.map((kind) => ({
        id: kind,
        label: t(`workspaces.people.actions.${kind}`),
        danger: kind === "remove" || kind === "leave",
        onSelect: () => onChoose({ kind, member }),
      }))}
    />
  );
}

function Heading({ query, onQuery }: { query: string; onQuery: (query: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="people-title" className="m-0 text-[17px] leading-6 font-semibold">
        {t("workspaces.people.everyone")}
      </h2>
      <Input
        id="find-person"
        icon="search"
        type="search"
        className="w-70 max-w-full"
        aria-label={t("workspaces.people.find")}
        placeholder={t("workspaces.people.find")}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
      />
    </div>
  );
}

export function MembersSection({ workspace, data, myId, onLeft }: MembersSectionProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const { change, pending, setPending, run, choose } = useMemberActions(workspace.id, onLeft);
  const confirmText = useConfirmText(pending, workspace.name);
  const allowed = new Set(data.yourActions);
  const needle = query.trim().toLowerCase();
  const shown = data.members.filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(needle));
  const rowFor = (member: Member) => (
    <Row
      key={member.userId}
      member={member}
      kinds={actionsFor(member, myId, allowed)}
      isMe={member.userId === myId}
      onChoose={choose}
    />
  );
  return (
    <section aria-labelledby="people-title" className="flex flex-col gap-3">
      <Heading query={query} onQuery={setQuery} />
      {pending ? null : <ActionErrorNotice error={change.error} onRetry={() => change.reset()} />}
      <MembersTable members={shown} rowFor={rowFor} />
      {shown.length === 0 ? (
        <p className="m-0 text-ink-muted">{t("workspaces.people.noMatch", { query: query.trim() })}</p>
      ) : null}
      <ConfirmDialog
        open={pending !== undefined}
        {...confirmText}
        pending={change.isPending}
        error={change.error}
        onConfirm={() => pending && run(pending)}
        onCancel={() => setPending(undefined)}
      />
    </section>
  );
}
