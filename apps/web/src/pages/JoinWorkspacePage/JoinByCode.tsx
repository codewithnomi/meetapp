// "Join with a link or code" (AC-F01-19, 20): find the workspace (only its name and size are shown),
// then "Ask to join" and "Request sent". Someone already in it is taken there with "You're already a
// member".
import { Button, Input, Notice, RequestRow } from "@meetapp/ui";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ActionErrorNotice } from "../../features/auth/index.ts";
import { useAskToJoin, useJoinLookup, type JoinLookup } from "../../features/workspaces/index.ts";

type Translate = ReturnType<typeof useTranslation>["t"];

/** A lookup's 404 means the link or code is wrong, off or replaced: say so plainly. */
function lookupError(t: Translate, code: string | undefined) {
  if (code === "NOT_FOUND") return t("workspaces.join.notFound");
  return undefined;
}

function FindForm({ onFound }: { onFound: (text: string, found: JoinLookup) => void }) {
  const { t } = useTranslation();
  const lookup = useJoinLookup();
  const [text, setText] = useState("");
  const [empty, setEmpty] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    setEmpty(value === "");
    if (value) lookup.mutate(value, { onSuccess: (found) => onFound(value, found) });
  };
  const fieldError = empty ? t("workspaces.join.empty") : lookupError(t, lookup.error?.code);
  return (
    <form noValidate onSubmit={submit} className="flex flex-wrap items-start gap-3">
      <Input
        id="join-code"
        icon="link"
        autoComplete="off"
        className="flex-[1_1_320px]"
        label={t("workspaces.join.field")}
        value={text}
        onChange={(event) => setText(event.target.value)}
        {...(fieldError ? { error: fieldError } : {})}
      />
      <div className="flex flex-col gap-1.5">
        <span aria-hidden="true" className="h-4.5" />
        {lookup.isPending ? (
          <Button type="submit" variant="secondary" loading loadingLabel={t("workspaces.join.finding")}>
            {t("workspaces.join.find")}
          </Button>
        ) : (
          <Button type="submit" variant="secondary">
            {t("workspaces.join.find")}
          </Button>
        )}
      </div>
      {lookup.error && !fieldError ? (
        <ActionErrorNotice error={lookup.error} onRetry={() => lookup.mutate(text.trim())} />
      ) : null}
    </form>
  );
}

export function JoinByCode({ onAlreadyMember }: { onAlreadyMember: (workspaceId: string, name: string) => void }) {
  const { t } = useTranslation();
  const ask = useAskToJoin();
  const [found, setFound] = useState<{ text: string; workspace: JoinLookup }>();
  const onFound = (text: string, workspace: JoinLookup) => {
    ask.reset();
    if (workspace.alreadyMember && workspace.workspaceId) onAlreadyMember(workspace.workspaceId, workspace.name);
    else setFound({ text, workspace });
  };
  const askToJoin = (text: string, name: string) =>
    ask.mutate(text, {
      onSuccess: (answer) =>
        answer.workspaceId && answer.status === "alreadyMember" && onAlreadyMember(answer.workspaceId, name),
    });
  return (
    <section aria-labelledby="code-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="code-title" className="m-0 text-[17px] leading-6 font-semibold">
          {t("workspaces.join.codeTitle")}
        </h2>
        <p className="m-0 text-[14px] text-ink-muted">{t("workspaces.join.codeHint")}</p>
      </div>
      <FindForm onFound={onFound} />
      {found ? (
        <RequestRow
          size="lg"
          className="rounded-lg border border-line bg-surface"
          leading={{ workspace: found.workspace.name }}
          title={found.workspace.name}
          detail={t("workspaces.join.people", { count: found.workspace.memberCount })}
          busy={ask.isPending || ask.isSuccess}
          actions={[{ label: t("workspaces.join.ask"), onClick: () => askToJoin(found.text, found.workspace.name) }]}
        />
      ) : null}
      <ActionErrorNotice error={ask.error} onRetry={() => found && askToJoin(found.text, found.workspace.name)} />
      {ask.data?.status === "pending" && found ? (
        <Notice tone="success" title={t("workspaces.join.sentTitle")}>
          {t("workspaces.join.sentText", { name: found.workspace.name })}
        </Notice>
      ) : null}
    </section>
  );
}
