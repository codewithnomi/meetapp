// Add people in a call from a chat (F15 AC-F15-13, approved canvas "Group call from a chat"): the chat's
// members who aren't in the call, each Ringing…, Declined with Ring again, or Add. Picking someone rings
// their app. Nobody outside the chat can be picked, and at 20 people Add is disabled. The list refreshes
// every 3 seconds while the panel is open.
import { CHAT_CALL_LIMITS } from "@meetapp/contracts";
import { Avatar, Button, SidePanel, Spinner } from "@meetapp/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ApiError } from "../../features/api/index.ts";
import { ActionErrorNotice } from "../../features/auth/index.ts";
import { ringPeople, runningCall } from "../../features/calls/index.ts";

export interface AddPeoplePanelProps {
  conversationId: string;
  callId: string;
  onClose: () => void;
}

type Member = { userId: string; name: string; inCall: boolean; ring: string | null };

function MemberLine({ member, full, onAdd }: { member: Member; full: boolean; onAdd: () => void }) {
  const { t } = useTranslation();
  const ringing = member.ring === "ringing";
  const declined = member.ring === "declined";
  return (
    <li className="flex min-h-13 items-center gap-2.5">
      <Avatar name={member.name} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{member.name}</span>
        {ringing ? <span className="text-[12px] font-semibold text-accent-text">{t("calls.add.ringing")}</span> : null}
        {declined ? <span className="text-[12px] text-ink-muted">{t("calls.add.declined")}</span> : null}
      </span>
      {ringing ? null : (
        <Button
          variant="secondary"
          size="sm"
          disabled={full}
          aria-label={t(declined ? "calls.add.ringAgainNamed" : "calls.add.addNamed", { name: member.name })}
          onClick={onAdd}
        >
          {t(declined ? "calls.add.ringAgain" : "calls.add.add")}
        </Button>
      )}
    </li>
  );
}

export function AddPeoplePanel({ conversationId, callId, onClose }: AddPeoplePanelProps) {
  const { t } = useTranslation();
  const running = useQuery<Awaited<ReturnType<typeof runningCall>>, ApiError>({
    queryKey: ["chat-call", conversationId],
    queryFn: () => runningCall(conversationId),
    refetchInterval: 3000,
  });
  const ring = useMutation<undefined, ApiError, string>({
    mutationFn: (userId: string) => ringPeople(callId, [userId]),
    onSettled: () => void running.refetch(),
  });
  const call = running.data?.call;
  const full = (call?.people ?? 0) >= CHAT_CALL_LIMITS.people;
  const members = call?.members.filter((m) => !m.inCall) ?? [];
  return (
    <SidePanel title={t("calls.add.title")} closeLabel={t("calls.add.close")} onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <p className="m-0 text-[13px] leading-4.5 text-ink-muted">{t("calls.add.intro")}</p>
        {running.isError ? <ActionErrorNotice error={running.error} onRetry={() => void running.refetch()} /> : null}
        {ring.isError ? <ActionErrorNotice error={ring.error} onRetry={() => ring.reset()} /> : null}
        {running.isPending ? <Spinner label={t("calls.add.loading")} /> : null}
        {call && members.length === 0 ? <p className="m-0 text-[13px]">{t("calls.add.everyone")}</p> : null}
        <ul aria-label={t("calls.add.members")} className="m-0 flex list-none flex-col gap-1 p-0">
          {members.map((member) => (
            <MemberLine key={member.userId} member={member} full={full} onAdd={() => ring.mutate(member.userId)} />
          ))}
        </ul>
        <p className="m-0 rounded-md bg-surface-sunken px-3 py-2.5 text-[13px] leading-4.5">
          {full ? t("calls.add.full") : t("calls.add.note")}
        </p>
      </div>
    </SidePanel>
  );
}
