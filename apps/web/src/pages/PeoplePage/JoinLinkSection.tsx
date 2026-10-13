// The join link and code on the People screen (AC-F01-19): the owner and admins switch it on or off and
// replace it; every member can copy it while it is on.
import { JoinLinkCard, Spinner } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { ActionErrorNotice } from "../../features/auth/index.ts";
import { useJoinLink, useJoinLinkChange } from "../../features/workspaces/index.ts";

/** Puts text on the clipboard; refuses where the clipboard isn't available. */
async function copyText(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !("clipboard" in navigator)) throw new Error("no clipboard");
  await navigator.clipboard.writeText(text);
}

function useLabels() {
  const { t } = useTranslation();
  return {
    title: t("workspaces.people.link.title"),
    description: t("workspaces.people.link.description"),
    copyLink: t("workspaces.people.link.copyLink"),
    copyCode: t("workspaces.people.link.copyCode"),
    copied: t("workspaces.people.link.copied"),
    copyFailed: t("workspaces.people.link.copyFailed"),
    replace: t("workspaces.people.link.replace"),
    off: t("workspaces.people.link.off"),
  };
}

export function JoinLinkSection({ workspaceId, canManage }: { workspaceId: string; canManage: boolean }) {
  const { t } = useTranslation();
  const labels = useLabels();
  const link = useJoinLink(workspaceId);
  const change = useJoinLinkChange(workspaceId);
  if (!link.data) {
    return link.isPending ? (
      <Spinner label={t("workspaces.people.link.loading")} />
    ) : (
      <ActionErrorNotice error={link.error} onRetry={() => void link.refetch()} />
    );
  }
  return (
    <section
      aria-label={t("workspaces.people.link.title")}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
    >
      <JoinLinkCard
        enabled={link.data.enabled}
        link={link.data.link}
        code={link.data.code}
        canManage={canManage}
        busy={change.isPending}
        onToggle={(enabled) => change.mutate({ kind: "toggle", enabled })}
        onReplace={() => change.mutate({ kind: "replace" })}
        onCopy={copyText}
        labels={labels}
      />
      <ActionErrorNotice error={change.error} onRetry={() => change.reset()} />
    </section>
  );
}
