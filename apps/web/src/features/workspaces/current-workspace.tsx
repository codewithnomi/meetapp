// Which workspace is open (AC-F01-16). Switching shows the new workspace at once and tells the backend
// in the background, so the app opens it again next time. The backend's choice (the last used, or
// Personal when that one is gone) is used until the person switches. When the open workspace leaves
// the list (removed, or left in another window), the app switches to Personal and says so (AC-F01-23).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiRequest } from "../api/index.ts";
import { useMe, type MyWorkspace } from "./me.ts";

/** A short message above the open screen, e.g. "You are no longer a member of Aria." */
export interface WorkspaceNotice {
  kind: "removed" | "alreadyMember";
  name: string;
}

interface CurrentWorkspace {
  workspaces: MyWorkspace[];
  current: MyWorkspace | undefined;
  switchTo: (id: string) => void;
  notice: WorkspaceNotice | undefined;
  showNotice: (notice: WorkspaceNotice | undefined) => void;
}

const Context = createContext<CurrentWorkspace>({
  workspaces: [],
  current: undefined,
  switchTo: () => {},
  notice: undefined,
  showNotice: () => {},
});

/** Watches the open workspace: once it is missing from a fresh list, it reports its name. */
function useLostWorkspace(workspaces: MyWorkspace[], current: MyWorkspace | undefined, onLost: (name: string) => void) {
  const open = useRef<MyWorkspace | undefined>(undefined);
  useEffect(() => {
    const previous = open.current;
    if (previous && workspaces.length > 0 && !workspaces.some((workspace) => workspace.id === previous.id)) {
      onLost(previous.name);
    }
    open.current = current;
  }, [workspaces, current, onLost]);
}

export function CurrentWorkspaceProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const [chosen, setChosen] = useState<string>();
  const [notice, showNotice] = useState<WorkspaceNotice>();
  const workspaces = useMemo(() => me.data?.workspaces ?? [], [me.data]);
  const current =
    workspaces.find((workspace) => workspace.id === chosen) ??
    workspaces.find((workspace) => workspace.id === me.data?.currentWorkspaceId) ??
    workspaces[0];
  const switchTo = useCallback((id: string) => {
    setChosen(id);
    // Only remembered for the next start; a failure changes nothing on screen.
    apiRequest("/api/v1/me/last-workspace", { method: "PUT", body: { workspaceId: id } }).catch(() => undefined);
  }, []);
  const personalId = workspaces.find((workspace) => workspace.kind === "personal")?.id;
  const onLost = useCallback(
    (name: string) => {
      if (personalId) setChosen(personalId);
      showNotice({ kind: "removed", name });
    },
    [personalId],
  );
  useLostWorkspace(workspaces, current, onLost);
  const value = useMemo(
    () => ({ workspaces, current, switchTo, notice, showNotice }),
    [workspaces, current, switchTo, notice],
  );
  return <Context value={value}>{children}</Context>;
}

export function useCurrentWorkspace(): CurrentWorkspace {
  return useContext(Context);
}
