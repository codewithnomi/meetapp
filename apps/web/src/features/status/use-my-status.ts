// The person's status for the picture menu and the tray (AC-F04-20, 21, 23). It is read again every 15
// seconds, so "In a call" and a status that ran out show without a reload.
import type { ManualStatus } from "@meetapp/contracts";
import type { StatusDuration } from "@meetapp/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { myStatus, setMyStatus } from "./status-api.ts";
import { untilFor } from "./until.ts";

const KEY = ["me", "status"];
const REFRESH_MS = 15_000;

export function useMyStatus() {
  const queryClient = useQueryClient();
  const [duration, setDuration] = useState<StatusDuration>("forever");
  const query = useQuery({ queryKey: KEY, queryFn: myStatus, refetchInterval: REFRESH_MS });
  const change = useMutation({
    mutationFn: ({ status, until }: { status: ManualStatus | null; until: string | null }) =>
      setMyStatus(status, until),
    onSuccess: (mine) => queryClient.setQueryData(KEY, mine),
  });
  return {
    mine: query.data,
    duration,
    choose: (status: ManualStatus, chosenFor: StatusDuration) => {
      setDuration(chosenFor);
      change.mutate({ status, until: untilFor(chosenFor, new Date()) });
    },
    reset: () => {
      setDuration("forever");
      change.mutate({ status: null, until: null });
    },
  };
}

/** The menu-bar or tray's status choice, until changed (AC-F04-05). Kept by the signed-in app, not the
 * picture menu, so it works while a meeting fills the screen. */
export function useStatusFromTray(): (status: ManualStatus) => void {
  const queryClient = useQueryClient();
  const change = useMutation({
    mutationFn: (status: ManualStatus) => setMyStatus(status, untilFor("forever", new Date())),
    onSuccess: (mine) => queryClient.setQueryData(KEY, mine),
  });
  return (status) => change.mutate(status);
}
