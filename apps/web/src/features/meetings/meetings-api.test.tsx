// Making and finding meetings (AC-F02-01, 46, 48).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeApi, json, refuse } from "../workspaces/fake-api.ts";
import { useCreateMeeting, useFindMeeting, useMeeting, useUpdateMeeting } from "./meetings-api.ts";

const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const MEETING = { id: "m1", title: "Budget" };

afterEach(() => {
  vi.unstubAllGlobals();
  client.clear();
});

describe("making a meeting", () => {
  it("TC-F02-46 [AC-F02-46] sends the Idempotency-Key and the title only when there is one, and keeps the result", async () => {
    const api = fakeApi({ "POST /api/v1/workspaces/w1/meetings": () => json(MEETING, 201) });
    const { result } = renderHook(() => useCreateMeeting("w1"), { wrapper });
    await act(() => result.current.mutateAsync({ kind: "meet_now", key: "k1" }));
    await act(() => result.current.mutateAsync({ kind: "link", title: "Budget", key: "k2" }));
    const calls = api.callsTo("POST", "/api/v1/workspaces/w1/meetings");
    expect(calls.map((c) => c.body)).toEqual([{ kind: "meet_now" }, { kind: "link", title: "Budget" }]);
    const sent = vi.mocked(fetch).mock.calls.map((c) => (c[1] as RequestInit).headers);
    expect(sent[0]).toMatchObject({ "idempotency-key": "k1" });
    expect(sent[1]).toMatchObject({ "idempotency-key": "k2" });
    expect(client.getQueryData(["meeting", "m1"])).toEqual(MEETING);
  });
});

describe("finding a meeting", () => {
  it("TC-F02-48 [AC-F02-48] a link or an ID with passcode is sent with the device key when there is one", async () => {
    const api = fakeApi({ "POST /api/v1/meeting-lookups": () => json({ title: "x" }) });
    vi.stubGlobal("meetapp", { deviceKey: async () => "dk-1" });
    const { result } = renderHook(() => useFindMeeting(), { wrapper });
    await act(() => result.current.mutateAsync({ link: "https://x/m/abc" }));
    vi.stubGlobal("meetapp", {});
    await act(() => result.current.mutateAsync({ meetingNumber: "123", passcode: "9" }));
    expect(api.callsTo("POST", "/api/v1/meeting-lookups").map((c) => c.body)).toEqual([
      { link: "https://x/m/abc", deviceKey: "dk-1" },
      { meetingNumber: "123", passcode: "9" },
    ]);
  });

  it("TC-F02-48 [AC-F02-48] any miss is the same not found", async () => {
    fakeApi({ "POST /api/v1/meeting-lookups": () => refuse("MEETING_NOT_FOUND", 404) });
    const { result } = renderHook(() => useFindMeeting(), { wrapper });
    await act(async () => void (await result.current.mutateAsync({ link: "x" }).catch(() => undefined)));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.code).toBe("MEETING_NOT_FOUND");
  });
});

describe("meeting details and options", () => {
  it("TC-F02-04 [AC-F02-02] reads the meeting only when it has an id", async () => {
    const api = fakeApi({ "GET /api/v1/meetings/m1": () => json(MEETING) });
    renderHook(() => useMeeting(undefined), { wrapper });
    const { result } = renderHook(() => useMeeting("m1"), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(MEETING));
    expect(api.calls.filter((c) => c.path === "/api/v1/meetings/")).toHaveLength(0);
  });

  it("TC-F02-04 [AC-F02-02] saving options sends a patch and replaces the saved meeting", async () => {
    const api = fakeApi({ "PATCH /api/v1/meetings/m1/options": () => json({ ...MEETING, title: "New" }) });
    const { result } = renderHook(() => useUpdateMeeting("m1"), { wrapper });
    await act(() => result.current.mutateAsync({ allowAttendeeMic: false }));
    expect(api.callsTo("PATCH", "/api/v1/meetings/m1/options")[0]?.body).toEqual({ allowAttendeeMic: false });
    expect(client.getQueryData(["meeting", "m1"])).toMatchObject({ title: "New" });
  });
});
