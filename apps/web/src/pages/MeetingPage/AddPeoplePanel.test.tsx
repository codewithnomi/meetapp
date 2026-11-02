// Add people in a call from a chat (F15 T15, AC-F15-13): only members not in the call are listed, with
// Ringing…, Declined + Ring again, or Add; picking one rings them; at 20 people Add is disabled.
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT } from "../../features/auth/fake-auth.tsx";
import { fakeApi, json, noContent } from "../../features/workspaces/fake-api.ts";
import { AddPeoplePanel } from "./AddPeoplePanel.tsx";

const CONVERSATION = "00000000-0000-4000-8000-0000000000c1";
const CALL = "00000000-0000-4000-8000-0000000000d1";
const id = (n: number) => `00000000-0000-4000-8000-00000000a${String(n).padStart(3, "0")}`;
const member = (n: number, name: string, inCall: boolean, ring: string | null) => ({
  userId: id(n),
  name,
  inCall,
  ring,
});

const running = (people: number, members: ReturnType<typeof member>[]) =>
  json({
    call: {
      callId: CALL,
      media: "video",
      startedAt: new Date().toISOString(),
      startedBy: { userId: id(1), name: "Olivia Owner" },
      people,
      members,
    },
  });

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <AddPeoplePanel conversationId={CONVERSATION} callId={CALL} onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

beforeEach(() => installFakeAuth(PAT));

describe("Add people", () => {
  it("TC-F15-30 [AC-F15-13] lists only members not in the call: Ringing…, Declined with Ring again, Add", async () => {
    fakeApi({
      [`GET /api/v1/conversations/${CONVERSATION}/call`]: () =>
        running(2, [
          member(2, "Mo Member", true, "accepted"),
          member(3, "Gus Guest", false, "ringing"),
          member(4, "Ann Aide", false, "declined"),
          member(5, "Bob Basil", false, null),
        ]),
    });
    show();
    expect(await screen.findByText("Gus Guest")).toBeInTheDocument();
    expect(screen.queryByText("Mo Member")).not.toBeInTheDocument();
    expect(screen.getByText("Ringing…")).toBeInTheDocument();
    expect(screen.getByText("Declined")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Gus Guest to the call" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ring Ann Aide again" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Add Bob Basil to the call" })).toBeEnabled();
  });

  it("TC-F15-30 [AC-F15-13] Add rings that person through the backend", async () => {
    const { calls } = fakeApi({
      [`GET /api/v1/conversations/${CONVERSATION}/call`]: () => running(2, [member(5, "Bob Basil", false, null)]),
      [`POST /api/v1/calls/${CALL}/ring`]: noContent,
    });
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Add Bob Basil to the call" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path.endsWith("/ring"))).toBe(true));
    const post = calls.find((c) => c.method === "POST");
    expect(JSON.stringify(post?.body ?? "")).toContain(id(5));
  });

  it("TC-F15-30 [AC-F15-13] at 20 people Add is disabled and the note says why", async () => {
    fakeApi({
      [`GET /api/v1/conversations/${CONVERSATION}/call`]: () => running(20, [member(5, "Bob Basil", false, null)]),
    });
    show();
    expect(await screen.findByRole("button", { name: "Add Bob Basil to the call" })).toBeDisabled();
    expect(screen.getByText("This call has 20 people, the most it can hold.")).toBeInTheDocument();
  });

  it("TC-F15-30 [AC-F15-13] when everyone is in the call it says so", async () => {
    fakeApi({
      [`GET /api/v1/conversations/${CONVERSATION}/call`]: () => running(2, [member(2, "Mo Member", true, "accepted")]),
    });
    show();
    expect(await screen.findByText("Everyone in this chat is in the call.")).toBeInTheDocument();
  });
});
