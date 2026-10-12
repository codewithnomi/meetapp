// Which workspace is open (AC-F01-16). Switching shows the new workspace at once and tells the backend
// in the background, so the app opens it again next time. The backend's choice (the last used, or
// Personal when that one is gone) is used until the person switches.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { apiRequest } from "../api/index.ts";
import { useMe, type MyWorkspace } from "./me.ts";

interface CurrentWorkspace {
  workspaces: MyWorkspace[];
  current: MyWorkspace | undefined;
  switchTo: (id: string) => void;
}

const Context = createContext<CurrentWorkspace>({ workspaces: [], current: undefined, switchTo: () => {} });

export function CurrentWorkspaceProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const [chosen, setChosen] = useState<string>();
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
  const value = useMemo(() => ({ workspaces, current, switchTo }), [workspaces, current, switchTo]);
  return <Context value={value}>{children}</Context>;
}

export function useCurrentWorkspace(): CurrentWorkspace {
  return useContext(Context);
}
