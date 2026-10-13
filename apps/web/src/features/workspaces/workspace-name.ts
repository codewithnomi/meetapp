// How a workspace's name is shown: the personal workspace is "Personal" in the app's language; company
// workspaces show the name people gave them, as plain text (AC-F01-35).
import { useTranslation } from "react-i18next";
import type { MyWorkspace } from "./me.ts";

export function useWorkspaceName() {
  const { t } = useTranslation();
  return (workspace: Pick<MyWorkspace, "kind" | "name">) =>
    workspace.kind === "personal" ? t("workspaces.personal") : workspace.name;
}
