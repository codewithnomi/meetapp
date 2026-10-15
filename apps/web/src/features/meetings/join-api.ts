// Joining, the lobby's status and leaving (F02 design.md sections 3.3–3.5, AC-F02-14, 15, 18). Lobby
// and call requests carry the meeting ticket in X-Meeting-Ticket. While waiting, the app asks for its
// status every 2 seconds; the answer that lets the person in carries the call server's pass.
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, type ApiError } from "../api/index.ts";
import { meetingDeviceKey } from "./device-key.ts";
import { useVisit, type Attendance, type Joined } from "./visit.ts";

const POLL_MS = 2_000;
const ticketHeader = (ticket: string) => ({ "x-meeting-ticket": ticket });

export function useJoinMeeting() {
  const start = useVisit((state) => state.start);
  return useMutation<Joined, ApiError, { lookupToken: string; guestName?: string }>({
    mutationFn: async ({ lookupToken, guestName }) =>
      apiRequest("/api/v1/meetings/join", {
        method: "POST",
        body: { lookupToken, deviceKey: await meetingDeviceKey(), ...(guestName === undefined ? {} : { guestName }) },
      }),
    onSuccess: start,
  });
}

/** The visit's status, asked every 2 seconds while waiting in the lobby. */
export function useLobbyStatus(visit: Joined | undefined) {
  const update = useVisit((state) => state.update);
  return useQuery<Attendance, ApiError>({
    queryKey: ["attendance", visit?.attendanceId ?? ""],
    queryFn: async () => {
      const attendance = await apiRequest<Attendance>(`/api/v1/attendances/${visit?.attendanceId ?? ""}`, {
        headers: ticketHeader(visit?.ticket ?? ""),
      });
      update(attendance);
      return attendance;
    },
    enabled: visit?.status === "waiting",
    refetchInterval: (query) => (query.state.data?.status === "waiting" || !query.state.data ? POLL_MS : false),
  });
}

/** Leave the lobby or the meeting; the visit ends in the app whatever the backend answers. Also sent
 * while the window closes, so the others see the person leave at once (AC-F02-32). */
export async function leaveMeeting(visit: Joined | undefined, closing = false): Promise<void> {
  if (!visit) return;
  await apiRequest(`/api/v1/attendances/${visit.attendanceId}`, {
    method: "DELETE",
    headers: ticketHeader(visit.ticket),
    keepalive: closing,
  }).catch(() => undefined);
}

/**
 * Rejoin after a lost connection (AC-F02-29): the old ticket, once, within 30 minutes. The backend makes a
 * new visit under the usual rules (lock, removal, lobby) with the old role.
 */
export function useRejoin() {
  const start = useVisit((state) => state.start);
  return useMutation<Joined, ApiError, Pick<Joined, "attendanceId" | "ticket">>({
    mutationFn: (old) =>
      apiRequest(`/api/v1/attendances/${old.attendanceId}/rejoin`, {
        method: "POST",
        headers: ticketHeader(old.ticket),
      }),
    onSuccess: start,
  });
}
