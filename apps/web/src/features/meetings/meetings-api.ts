// Making and finding meetings (F02 design.md sections 3.1, 3.2 and 6). Making one carries an
// Idempotency-Key, so a double click or a retry makes one meeting (AC-F02-46). Finding one works signed
// in or out; any miss is the same "not found" (AC-F02-48).
import type {
  MeetingDetails,
  meetingCreatedSchema,
  meetingLookupResponseSchema,
  updateMeetingBodySchema,
} from "@meetapp/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { apiRequest, type ApiError } from "../api/index.ts";
import { deviceKey } from "./device-key.ts";

export type MeetingCreated = z.infer<typeof meetingCreatedSchema>;
export type MeetingFound = z.infer<typeof meetingLookupResponseSchema>;
export type MeetingChange = z.infer<typeof updateMeetingBodySchema>;
export type { MeetingDetails };

const meetingKey = (meetingId: string) => ["meeting", meetingId] as const;

export function useCreateMeeting(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation<MeetingCreated, ApiError, { kind: "meet_now" | "link"; title?: string; key: string }>({
    mutationFn: ({ kind, title, key }) =>
      apiRequest(`/api/v1/workspaces/${workspaceId}/meetings`, {
        method: "POST",
        body: { kind, ...(title ? { title } : {}) },
        headers: { "idempotency-key": key },
      }),
    onSuccess: (meeting) => queryClient.setQueryData(meetingKey(meeting.id), meeting),
  });
}

/** By link, or by meeting ID and passcode. */
export type MeetingAddress = { link: string } | { meetingNumber: string; passcode: string };

export function useFindMeeting() {
  return useMutation<MeetingFound, ApiError, MeetingAddress>({
    mutationFn: async (address) => {
      const key = await deviceKey();
      return apiRequest("/api/v1/meeting-lookups", {
        method: "POST",
        body: { ...address, ...(key ? { deviceKey: key } : {}) },
      });
    },
  });
}

/** The organizer's and co-organizers' view: link, ID, passcode and options. */
export function useMeeting(meetingId: string | undefined) {
  return useQuery<MeetingDetails, ApiError>({
    queryKey: meetingKey(meetingId ?? ""),
    queryFn: () => apiRequest(`/api/v1/meetings/${meetingId ?? ""}`),
    enabled: meetingId !== undefined,
  });
}

export function useUpdateMeeting(meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation<MeetingDetails, ApiError, MeetingChange>({
    mutationFn: (change) => apiRequest(`/api/v1/meetings/${meetingId}/options`, { method: "PATCH", body: change }),
    onSuccess: (meeting) => queryClient.setQueryData(meetingKey(meetingId), meeting),
  });
}

/** What the pre-join screen needs: handed over by the screen that found or made the meeting. */
export interface PreJoinState {
  title: string;
  lookupToken: string;
  group: MeetingFound["group"];
}
