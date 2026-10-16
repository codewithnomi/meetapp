// Joining, the lobby's 2-second status, leaving and Rejoin (AC-F02-14, 15, 18, 29, 32).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, json, noContent, refuse } from "../workspaces/fake-api.ts";
import { VISIT } from "./fake-visit.ts";
import { leaveMeeting, useJoinMeeting, useLobbyStatus, useRejoin } from "./join-api.ts";
import { useVisit } from "./visit.ts";

const ATTENDANCE = `/api/v1/attendances/${VISIT.attendanceId}`;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => useVisit.setState({ visit: undefined }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("lobby status", () => {
  it("TC-F02-32 [AC-F02-14] asks every 2 seconds while waiting, keeping the ticket in the header", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = fakeApi({ [`GET ${ATTENDANCE}`]: () => json({ attendanceId: VISIT.attendanceId, status: "waiting" }) });
    const fetchMock = vi.mocked(fetch);
    useVisit.getState().start(VISIT);
    renderHook(() => useLobbyStatus(VISIT), { wrapper });
    await waitFor(() => expect(api.callsTo("GET", ATTENDANCE)).toHaveLength(1));
    await act(() => vi.advanceTimersByTimeAsync(2_100));
    await waitFor(() => expect(api.callsTo("GET", ATTENDANCE).length).toBeGreaterThanOrEqual(2));
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({ "x-meeting-ticket": "ticket-1" });
  });

  it("T-fix-3 the lobby poll stops after an error", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = fakeApi({ [`GET ${ATTENDANCE}`]: () => refuse("ATTENDANCE_NOT_FOUND", 404) });
    const { result } = renderHook(() => useLobbyStatus(VISIT), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(api.callsTo("GET", ATTENDANCE)).toHaveLength(1);
  });

  it("TC-F02-32 [AC-F02-14] stops asking once the person is admitted, and the visit is updated", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = fakeApi({
      [`GET ${ATTENDANCE}`]: () => json({ attendanceId: VISIT.attendanceId, status: "admitted" }),
    });
    useVisit.getState().start(VISIT);
    renderHook(() => useLobbyStatus(VISIT), { wrapper });
    await waitFor(() => expect(useVisit.getState().visit?.status).toBe("admitted"));
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(api.callsTo("GET", ATTENDANCE)).toHaveLength(1);
  });

  it("TC-F02-32 [AC-F02-14] does not ask when there is no visit or the person is not waiting", async () => {
    const api = fakeApi();
    renderHook(() => useLobbyStatus(undefined), { wrapper });
    renderHook(() => useLobbyStatus({ ...VISIT, status: "admitted" }), { wrapper });
    await act(async () => void (await Promise.resolve()));
    expect(api.calls.filter((c) => c.path.startsWith("/api/v1/attendances"))).toHaveLength(0);
  });
});

describe("leaving", () => {
  it("TC-F02-32 [AC-F02-18] leaving sends the ticket; closing the window uses keepalive", async () => {
    const api = fakeApi({ [`DELETE ${ATTENDANCE}`]: noContent });
    await leaveMeeting(VISIT);
    await leaveMeeting(VISIT, true);
    const inits = vi.mocked(fetch).mock.calls.map((c) => c[1] as RequestInit);
    expect(api.callsTo("DELETE", ATTENDANCE)).toHaveLength(2);
    expect(inits[0]).toMatchObject({ headers: { "x-meeting-ticket": "ticket-1" } });
    expect(inits[0]).not.toHaveProperty("keepalive");
    expect(inits[1]).toMatchObject({ keepalive: true });
  });

  it("TC-F02-32 [AC-F02-18] a failing leave never throws, and no visit sends nothing", async () => {
    const api = fakeApi({ [`DELETE ${ATTENDANCE}`]: () => refuse("NOT_FOUND", 404) });
    await expect(leaveMeeting(VISIT)).resolves.toBeUndefined();
    await leaveMeeting(undefined);
    expect(api.callsTo("DELETE", ATTENDANCE)).toHaveLength(1);
  });
});

describe("joining and Rejoin", () => {
  const joined = { ...VISIT, status: "admitted" };

  it("TC-F02-21 [AC-F02-11] joining sends the lookup token, a device key and the guest name, then starts the visit", async () => {
    const api = fakeApi({ "POST /api/v1/meetings/join": () => json(joined) });
    const { result } = renderHook(() => useJoinMeeting(), { wrapper });
    await act(() => result.current.mutateAsync({ lookupToken: "t", guestName: "Gus" }));
    await act(() => result.current.mutateAsync({ lookupToken: "t" }));
    const [first, second] = api.callsTo("POST", "/api/v1/meetings/join").map((c) => c.body as Record<string, unknown>);
    expect(first).toMatchObject({ lookupToken: "t", guestName: "Gus" });
    expect(typeof first?.deviceKey).toBe("string");
    expect(second).not.toHaveProperty("guestName");
    expect(useVisit.getState().visit?.status).toBe("admitted");
  });

  it("TC-F02-31 [AC-F02-29] Rejoin sends the old ticket and starts the new visit", async () => {
    const api = fakeApi({ [`POST ${ATTENDANCE}/rejoin`]: () => json({ ...joined, ticket: "ticket-2" }) });
    const { result } = renderHook(() => useRejoin(), { wrapper });
    await act(() => result.current.mutateAsync({ attendanceId: VISIT.attendanceId, ticket: "ticket-1" }));
    expect(api.callsTo("POST", `${ATTENDANCE}/rejoin`)).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({ headers: { "x-meeting-ticket": "ticket-1" } });
    expect(useVisit.getState().visit?.ticket).toBe("ticket-2");
  });
});
