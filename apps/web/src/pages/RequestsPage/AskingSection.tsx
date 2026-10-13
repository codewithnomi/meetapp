// "Asking to join" (AC-F01-19): people who used the join link or code, with Approve and Reject, and a
// "Removed earlier" badge for someone removed from this workspace before. Owner and admins only.
import { RequestRow, Spinner } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { ActionErrorNotice } from "../../features/auth/index.ts";
import { relativeTime, useDecideRequest, useJoinRequests, type JoinRequest } from "../../features/workspaces/index.ts";

function Request({
  request,
  busy,
  onDecide,
}: {
  request: JoinRequest;
  busy: boolean;
  onDecide: (d: "approve" | "reject") => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <RequestRow
      leading={{ person: request.person.name }}
      title={request.person.name}
      detail={t("workspaces.requests.askedDetail", {
        email: request.person.email,
        when: relativeTime(request.createdAt, i18n.language),
        how: t(`workspaces.requests.how.${request.via}`),
      })}
      badge={request.removedEarlier ? t("workspaces.requests.removedEarlier") : undefined}
      busy={busy}
      actions={[
        { label: t("workspaces.requests.reject"), variant: "ghost", onClick: () => onDecide("reject") },
        { label: t("workspaces.requests.approve"), onClick: () => onDecide("approve") },
      ]}
    />
  );
}

export function AskingSection({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const requests = useJoinRequests(workspaceId);
  const decide = useDecideRequest(workspaceId);
  const waiting = (requests.data?.requests ?? []).filter((request) => request.status === "pending");
  return (
    <section aria-labelledby="asking-title" className="flex flex-col gap-3">
      <h2 id="asking-title" className="m-0 text-[17px] leading-6 font-semibold">
        {t("workspaces.requests.asking", { count: waiting.length })}
      </h2>
      <ActionErrorNotice error={requests.error ?? decide.error} onRetry={() => void requests.refetch()} />
      {requests.isPending ? <Spinner label={t("workspaces.requests.loading")} /> : null}
      {waiting.length > 0 ? (
        <ul className="m-0 list-none rounded-lg border border-line bg-surface p-0">
          {waiting.map((request) => (
            <li key={request.id} className="border-b border-line last:border-b-0">
              <Request
                request={request}
                busy={decide.isPending && decide.variables.id === request.id}
                onDecide={(decision) => decide.mutate({ id: request.id, decision })}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {requests.isSuccess && waiting.length === 0 ? (
        <p className="m-0 text-ink-muted">{t("workspaces.requests.noRequests")}</p>
      ) : null}
      <p className="m-0 text-[13px] text-ink-muted">{t("workspaces.requests.footnote")}</p>
    </section>
  );
}
