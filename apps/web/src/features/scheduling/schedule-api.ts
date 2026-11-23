// Scheduling a meeting, changing or cancelling it, and sending failed invites again (F13 design.md "API").
// Each success refreshes the calendar and the meeting's details. A refusal keeps the form as it was and
// says why (field errors, or how long to wait, AC-F13-14).
import type { ScheduleBody } from "@meetapp/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, type ApiError } from "../api/index.ts";

export type ScheduleUpdate = Partial<ScheduleBody> & { scope: "series" | "occurrence"; originalStart?: string };
export interface ScheduleCancel {
  scope: "series" | "occurrence";
  originalStart?: string;
  message?: string;
}

function useRefresh() {
  const queryClient = useQueryClient();
  return (meetingId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    if (meetingId) void queryClient.invalidateQueries({ queryKey: ["schedule", meetingId] });
  };
}

export function useScheduleMeeting(workspaceId: string) {
  const refresh = useRefresh();
  return useMutation<{ meetingId: string }, ApiError, ScheduleBody>({
    mutationFn: (body) => apiRequest(`/api/v1/workspaces/${workspaceId}/scheduled-meetings`, { method: "POST", body }),
    onSuccess: () => refresh(),
  });
}

export function useUpdateSchedule(meetingId: string) {
  const refresh = useRefresh();
  return useMutation<unknown, ApiError, ScheduleUpdate>({
    mutationFn: (body) => apiRequest(`/api/v1/meetings/${meetingId}/schedule`, { method: "PATCH", body }),
    onSuccess: () => refresh(meetingId),
  });
}

export function useCancelSchedule(meetingId: string) {
  const refresh = useRefresh();
  return useMutation<unknown, ApiError, ScheduleCancel>({
    mutationFn: (body) => apiRequest(`/api/v1/meetings/${meetingId}/schedule/cancel`, { method: "POST", body }),
    onSuccess: () => refresh(meetingId),
  });
}

export function useResendInvites(meetingId: string) {
  const refresh = useRefresh();
  return useMutation<unknown, ApiError, undefined>({
    mutationFn: () => apiRequest(`/api/v1/meetings/${meetingId}/schedule/resend`, { method: "POST" }),
    onSuccess: () => refresh(meetingId),
  });
}

/** The form's words for a refusal: the reason and, for a limit, the minutes to wait. */
export function refusalText(error: ApiError): { key: string; minutes?: number } {
  const minutes = Math.max(1, Math.ceil((error.retryAfterSeconds ?? 60) / 60));
  if (error.code === "TOO_MANY_EMAILS") return { key: "schedule.errors.tooManyEmails", minutes };
  if (error.code === "TOO_MANY_ATTEMPTS") return { key: "schedule.errors.tooManyMeetings", minutes };
  if (error.code === "NETWORK_ERROR") return { key: "schedule.errors.offline" };
  return { key: "schedule.errors.failed" };
}
