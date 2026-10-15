// The lobby inside the call (AC-F02-15), for those who may let people in: read when the server says it
// changed (and every 10 seconds in case a message was missed); arrivals are announced (AC-F02-44).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { decideLobby, lobbyOf, type Joined, type Waiting } from "../../features/meetings/index.ts";

const FALLBACK_MS = 10_000;
const lobbyKey = (visit: Joined) => ["lobby", visit.call?.callId ?? ""];

export function useLobby(visit: Joined, allowed: boolean, announce: (kind: string, text: string) => void) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: lobbyKey(visit),
    queryFn: () => lobbyOf(visit),
    enabled: allowed,
    refetchInterval: FALLBACK_MS,
  });
  const waiting: Waiting[] = allowed ? (query.data?.waiting ?? []) : [];
  const seen = useRef(new Set<string>());
  useEffect(() => {
    for (const person of waiting) {
      if (!seen.current.has(person.attendanceId))
        announce(`lobby-${person.attendanceId}`, t("meetings.call.lobbyArrived", { name: person.name }));
    }
    seen.current = new Set(waiting.map((p) => p.attendanceId));
  }, [waiting, announce, t]);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: lobbyKey(visit) });
  const decide = (decision: "admit" | "deny", who: { attendanceIds: string[] } | { all: true }) =>
    void decideLobby(visit, decision, who)
      .catch(() => undefined)
      .finally(refresh);
  return { waiting, refresh, decide };
}

export type Lobby = ReturnType<typeof useLobby>;
