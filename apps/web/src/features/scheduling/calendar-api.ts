// The calendar's data (F13 design.md "API"): the meetings in a range of the open workspace, a meeting's
// details, and the person's answer. A live "calendar" message on the live line (D064) refreshes both, so
// changes made elsewhere show at once (AC-F13-09, 16).
import type { CalendarOccurrence, InviteAnswer, ScheduleDetails } from "@meetapp/contracts";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { apiRequest, type ApiError } from "../api/index.ts";
import { useLiveLine } from "../chats/index.ts";

export type { CalendarOccurrence, InviteAnswer, ScheduleDetails };

const CALENDAR = "calendar";
const DETAILS = "schedule";

export function useCalendar(workspaceId: string | undefined, range: { from: Date; to: Date }) {
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  return useQuery<{ occurrences: CalendarOccurrence[]; truncated: boolean }, ApiError>({
    queryKey: [CALENDAR, workspaceId, from, to],
    queryFn: () =>
      apiRequest(
        `/api/v1/workspaces/${workspaceId ?? ""}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    enabled: workspaceId !== undefined,
    placeholderData: (previous) => previous,
  });
}

export function useScheduleDetails(meetingId: string | undefined) {
  return useQuery<ScheduleDetails, ApiError>({
    queryKey: [DETAILS, meetingId],
    queryFn: () => apiRequest(`/api/v1/meetings/${meetingId ?? ""}/schedule`),
    enabled: meetingId !== undefined,
  });
}

export function useAnswer(meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    unknown,
    ApiError,
    { answer: InviteAnswer; scope: "series" | "occurrence"; originalStart?: string }
  >({
    mutationFn: (body) => apiRequest(`/api/v1/meetings/${meetingId}/schedule/answer`, { method: "PUT", body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CALENDAR] });
      void queryClient.invalidateQueries({ queryKey: [DETAILS, meetingId] });
    },
  });
}

/** Refresh the calendar and the meeting's details when the live line says something changed. */
export function useCalendarNews() {
  const queryClient = useQueryClient();
  const listener = useCallback(
    (message: { t: string; meetingId?: string }) => {
      if (message.t !== "calendar" && message.t !== "connected") return;
      void queryClient.invalidateQueries({ queryKey: [CALENDAR] });
      if (message.meetingId) void queryClient.invalidateQueries({ queryKey: [DETAILS, message.meetingId] });
    },
    [queryClient],
  );
  useLiveLine(listener);
}

/** Whether the computer is online; the last data stays when it isn't (AC-F13-32). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
