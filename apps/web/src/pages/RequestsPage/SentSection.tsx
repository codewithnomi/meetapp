// "Invitations sent" (AC-F01-17): invitations waiting for an answer, with Cancel and "Send again" (a
// new link and email; the old link stops). The owner and admins see all; a member sees their own.
import { Notice, RequestRow, Spinner } from "@meetapp/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionErrorNotice } from "../../features/auth/index.ts";
import {
  relativeTime,
  useInvitationAction,
  useSentInvitations,
  type SentInvitation,
} from "../../features/workspaces/index.ts";

type Act = (kind: "cancel" | "resend") => void;

function Invitation({ invitation, busy, onAct }: { invitation: SentInvitation; busy: boolean; onAct: Act }) {
  const { t, i18n } = useTranslation();
  const values = {
    role: t(`workspaces.roleWords.${invitation.role}`),
    name: invitation.invitedBy?.name ?? "",
    when: relativeTime(invitation.expiresAt, i18n.language),
  };
  return (
    <RequestRow
      leading={{ icon: "send" }}
      title={invitation.email}
      detail={
        invitation.invitedBy
          ? t("workspaces.requests.sentDetail", values)
          : t("workspaces.requests.sentDetailNoSender", values)
      }
      busy={busy}
      actions={[
        { label: t("workspaces.requests.cancel"), variant: "ghost", onClick: () => onAct("cancel") },
        { label: t("workspaces.requests.resend"), variant: "secondary", onClick: () => onAct("resend") },
      ]}
    />
  );
}

export function SentSection({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const sent = useSentInvitations(workspaceId);
  const action = useInvitationAction(workspaceId);
  const [resentTo, setResentTo] = useState<string>();
  const invitations = sent.data?.invitations ?? [];
  const act = (invitation: SentInvitation) => (kind: "cancel" | "resend") => {
    setResentTo(undefined);
    action.mutate(
      { kind, id: invitation.id },
      { onSuccess: () => setResentTo(kind === "resend" ? invitation.email : undefined) },
    );
  };
  return (
    <section aria-labelledby="sent-title" className="flex flex-col gap-3">
      <h2 id="sent-title" className="m-0 text-[17px] leading-6 font-semibold">
        {t("workspaces.requests.sent", { count: invitations.length })}
      </h2>
      <ActionErrorNotice error={sent.error ?? action.error} onRetry={() => void sent.refetch()} />
      {resentTo ? <Notice tone="success">{t("workspaces.requests.resent", { email: resentTo })}</Notice> : null}
      {sent.isPending ? <Spinner label={t("workspaces.requests.loading")} /> : null}
      {invitations.length > 0 ? (
        <ul className="m-0 list-none rounded-lg border border-line bg-surface p-0">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="border-b border-line last:border-b-0">
              <Invitation
                invitation={invitation}
                busy={action.isPending && action.variables.id === invitation.id}
                onAct={act(invitation)}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {sent.isSuccess && invitations.length === 0 ? (
        <p className="m-0 text-ink-muted">{t("workspaces.requests.noInvitations")}</p>
      ) : null}
    </section>
  );
}
