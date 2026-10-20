// "Invite by email" on the People screen (AC-F01-17): checks the addresses, sends one invitation each,
// then says who got one; addresses that were refused stay in the field with the reason underneath
// ("<email> is already a member", the daily limit, no connection).
import type { TFunction } from "i18next";
import { InviteForm, Notice, type InviteRole } from "@meetapp/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorText } from "../../features/auth/index.ts";
import { useInvite, type InviteOutcome } from "../../features/workspaces/index.ts";
import { MAX_INVITES, parseEmails, type ParsedEmails } from "./invite-emails.ts";

type Translate = TFunction;

function problemText(t: Translate, parsed: Exclude<ParsedEmails, { ok: true }>): string {
  if (parsed.problem === "badEmail") return t("workspaces.people.invite.badEmail", { email: parsed.email });
  if (parsed.problem === "tooMany") return t("workspaces.people.invite.tooMany", { max: MAX_INVITES });
  return t("workspaces.people.invite.empty");
}

function refusalText(t: Translate, { email, code }: InviteOutcome["refused"][number]): string {
  if (code === "ALREADY_MEMBER") return t("workspaces.people.invite.alreadyMember", { email });
  if (code === "TOO_MANY_ATTEMPTS") return t("workspaces.people.invite.limit");
  if (code === "BAD_REQUEST") return t("workspaces.people.invite.badEmail", { email });
  const text = errorText(code);
  return t(text.key, text.values ?? {});
}

function useLabels() {
  const { t } = useTranslation();
  return {
    emails: t("workspaces.people.invite.emails"),
    placeholder: t("workspaces.people.invite.placeholder"),
    hint: t("workspaces.people.invite.hint"),
    role: t("workspaces.people.invite.role"),
    roles: { member: t("workspaces.people.invite.roles.member"), admin: t("workspaces.people.invite.roles.admin") },
    submit: t("workspaces.people.invite.submit"),
    pending: t("workspaces.people.invite.pending"),
  };
}

/** The field, the role, the problem under the field and who was just invited. */
function useInviteState(workspaceId: string, canInviteAdmin: boolean) {
  const { t } = useTranslation();
  const invite = useInvite(workspaceId);
  const [value, setValue] = useState("");
  const [role, setRole] = useState<InviteRole>("member");
  const [problem, setProblem] = useState<string>();
  const [sent, setSent] = useState<string[]>([]);
  const submit = () => {
    const parsed = parseEmails(value);
    setSent([]);
    if (!parsed.ok) return setProblem(problemText(t, parsed));
    setProblem(undefined);
    invite.mutate(
      { emails: parsed.emails, role: canInviteAdmin ? role : "member" },
      {
        onSuccess: (outcome) => {
          setValue(outcome.refused.map((refused) => refused.email).join(", "));
          setSent(outcome.sent);
          setProblem(outcome.refused[0] ? refusalText(t, outcome.refused[0]) : undefined);
        },
      },
    );
  };
  return { value, setValue, role, setRole, problem, sent, submit, pending: invite.isPending };
}

export function InviteSection({ workspaceId, canInviteAdmin }: { workspaceId: string; canInviteAdmin: boolean }) {
  const { t } = useTranslation();
  const labels = useLabels();
  const state = useInviteState(workspaceId, canInviteAdmin);
  const { sent } = state;
  return (
    <section
      aria-labelledby="invite-title"
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5"
    >
      <h2 id="invite-title" className="m-0 text-[17px] leading-6 font-semibold">
        {t("workspaces.people.invite.title")}
      </h2>
      <InviteForm
        value={state.value}
        onValueChange={state.setValue}
        role={state.role}
        onRoleChange={state.setRole}
        canInviteAdmin={canInviteAdmin}
        pending={state.pending}
        error={state.problem}
        onSubmit={state.submit}
        labels={labels}
      />
      {sent.length > 0 ? (
        <Notice tone="success">
          {t("workspaces.people.invite.sent", { count: sent.length, list: sent.join(", ") })}
        </Notice>
      ) : null}
    </section>
  );
}
