// "Invitations for <email>" on the Join screen (AC-F01-18): Join adds the workspace at once with the
// invited role and opens it; Decline removes the invitation.
import { RequestRow, Spinner } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { ActionErrorNotice, useSession } from "../../features/auth/index.ts";
import {
  relativeTime,
  useAnswerInvitation,
  useMyInvitations,
  type MyInvitation,
} from "../../features/workspaces/index.ts";

function detail(t: ReturnType<typeof useTranslation>["t"], invitation: MyInvitation, language: string) {
  const values = {
    name: invitation.inviterName ?? "",
    role: t(`workspaces.roleWords.${invitation.role}`),
    when: relativeTime(invitation.expiresAt, language),
  };
  return invitation.inviterName ? t("workspaces.join.invitedBy", values) : t("workspaces.join.invited", values);
}

export function MyInvitations({ onJoined }: { onJoined: (workspaceId: string) => void }) {
  const { t, i18n } = useTranslation();
  const { data: user } = useSession();
  const mine = useMyInvitations();
  const answer = useAnswerInvitation();
  const invitations = mine.data?.invitations ?? [];
  const respond = (kind: "accept" | "decline", id: string) =>
    answer.mutate({ kind, id }, { onSuccess: (accepted) => accepted && onJoined(accepted.switchTo) });
  return (
    <section aria-labelledby="invitations-title" className="flex flex-col gap-3">
      <h2 id="invitations-title" className="m-0 text-[17px] leading-6 font-semibold">
        {t("workspaces.join.invitationsFor", { email: user?.email ?? "" })}
      </h2>
      <ActionErrorNotice error={mine.error ?? answer.error} onRetry={() => void mine.refetch()} />
      {mine.isPending ? <Spinner label={t("workspaces.join.loading")} /> : null}
      {invitations.length === 0 && mine.isSuccess ? (
        <p className="m-0 text-ink-muted">{t("workspaces.join.noInvitations")}</p>
      ) : null}
      {invitations.map((invitation) => (
        <RequestRow
          key={invitation.id}
          size="lg"
          className="rounded-lg border border-line bg-surface"
          leading={{ workspace: invitation.workspace.name, tone: "accent" }}
          title={invitation.workspace.name}
          detail={detail(t, invitation, i18n.language)}
          busy={answer.isPending}
          actions={[
            { label: t("workspaces.join.decline"), variant: "ghost", onClick: () => respond("decline", invitation.id) },
            { label: t("workspaces.join.accept"), onClick: () => respond("accept", invitation.id) },
          ]}
        />
      ))}
    </section>
  );
}
