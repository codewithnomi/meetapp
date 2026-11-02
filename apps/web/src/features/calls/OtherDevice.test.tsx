// "You're in a call on another device" (F15 T16, AC-F15-33): the banner, Join and Transfer.
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT } from "../auth/fake-auth.tsx";
import { VISIT } from "../meetings/fake-visit.ts";
import { useVisit } from "../meetings/index.ts";
import { fakeApi, json } from "../workspaces/fake-api.ts";
import { useChatCall } from "./chat-call.ts";
import { OtherDevice } from "./OtherDevice.tsx";

const CALL_ID = "00000000-0000-4000-8000-0000000000d1";
const OLD_SEAT = "00000000-0000-4000-8000-0000000000e1";
const NEW_SEAT = "00000000-0000-4000-8000-0000000000e2";
const ACTIVE = {
  calls: [
    {
      callId: CALL_ID,
      conversationId: "00000000-0000-4000-8000-0000000000c1",
      meetingId: null,
      title: "Release team",
      media: "video",
      seats: [{ attendanceId: OLD_SEAT, joinedAt: new Date().toISOString() }],
    },
  ],
};
const JOINED = { ...VISIT, attendanceId: NEW_SEAT, status: "in_call", title: "Release team" };

function show(onEntered = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <OtherDevice onEntered={onEntered} />
    </QueryClientProvider>,
  );
  return onEntered;
}

const routes = () => ({
  "/api/v1/me/calls/active": () => json(ACTIVE),
  [`POST /api/v1/calls/${CALL_ID}/join`]: () => json(JOINED),
  [`POST /api/v1/calls/${CALL_ID}/transfer`]: () => json(JOINED),
});

beforeEach(() => installFakeAuth(PAT));
afterEach(() => {
  useChatCall.setState({ call: undefined, left: undefined });
  useVisit.getState().end();
});

describe("the call on another device", () => {
  it("TC-F15-43 [AC-F15-33] shows the banner with the call title and both buttons", async () => {
    fakeApi(routes());
    show();
    const banner = await screen.findByRole("region", { name: "Call on another device" });
    expect(banner).toHaveTextContent("You're in a call on another device");
    expect(banner).toHaveTextContent("Release team");
    expect(screen.getByRole("button", { name: "Join on this device" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transfer to this device" })).toBeInTheDocument();
  });

  it("TC-F15-43 [AC-F15-33] is hidden when this window is already in a call", async () => {
    const { calls: api } = fakeApi(routes());
    useVisit.getState().start({ ...VISIT, status: "in_call" });
    show();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("region", { name: "Call on another device" })).not.toBeInTheDocument();
    expect(api.some((c) => c.path.includes("/calls/active"))).toBe(false);
  });

  it("TC-F15-43 [AC-F15-33] is hidden when no call has a seat", async () => {
    fakeApi({ ...routes(), "/api/v1/me/calls/active": () => json({ calls: [] }) });
    show();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("region", { name: "Call on another device" })).not.toBeInTheDocument();
  });

  it("TC-F15-43 [AC-F15-33] Transfer posts the old seat, starts the call here and goes to the call", async () => {
    const { calls: api } = fakeApi(routes());
    const entered = show();
    await userEvent.click(await screen.findByRole("button", { name: "Transfer to this device" }));
    await waitFor(() => expect(entered).toHaveBeenCalledTimes(1));
    const post = api.find((c) => c.path.endsWith("/transfer"));
    expect(post?.method).toBe("POST");
    expect(post?.body).toEqual({ fromAttendanceId: OLD_SEAT });
    expect(useVisit.getState().visit?.attendanceId).toBe(NEW_SEAT);
    expect(useChatCall.getState().call).toMatchObject({ callId: CALL_ID, media: "video", phase: "in_call" });
  });

  it("TC-F15-43 [AC-F15-33] Join posts /join without transferring", async () => {
    const { calls: api } = fakeApi(routes());
    const entered = show();
    await userEvent.click(await screen.findByRole("button", { name: "Join on this device" }));
    await waitFor(() => expect(entered).toHaveBeenCalledTimes(1));
    expect(api.some((c) => c.path.endsWith(`/calls/${CALL_ID}/join`) && c.method === "POST")).toBe(true);
    expect(api.some((c) => c.path.endsWith("/transfer"))).toBe(false);
  });
});
