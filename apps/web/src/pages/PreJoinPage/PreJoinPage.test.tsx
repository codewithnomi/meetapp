// PreJoinPage with a stubbed backend and no camera or microphone: TC-F02-90 (AC-F02-45), the states while
// joining, when joining fails, and when there is no meeting to show; TC-F02-21 (AC-F02-11) at screen
// level: the guest name rule and the Terms text.
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { never, stubNoDevices } from "../../features/meetings/fake-visit.ts";
import { fakeApi, refuse } from "../../features/workspaces/fake-api.ts";
import { PreJoinPage } from "./PreJoinPage.tsx";

const JOIN = "POST /api/v1/meetings/join";
const MEETING = { title: "Budget review", lookupToken: "lookup-1", group: "guest" as const };

beforeEach(() => {
  installFakeAuth(null);
  stubNoDevices();
});
afterEach(() => vi.unstubAllGlobals());

const open = (userName?: string) =>
  renderWithApp(<PreJoinPage meeting={MEETING} userName={userName} onCancel={vi.fn()} onJoined={vi.fn()} />);

describe("TC-F02-90 pre-join loading and error states", () => {
  it("TC-F02-90 [AC-F02-45] shows the title, the missing-device notes and a waiting state while joining", async () => {
    fakeApi({ [JOIN]: never });
    open("Pat Lee");
    expect(screen.getByRole("heading", { level: 1, name: "Budget review" })).toBeInTheDocument();
    expect(await screen.findByText(/No camera found/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Join now" }));
    expect(await screen.findByText("Joining")).toBeInTheDocument();
  });

  it("TC-F02-90 [AC-F02-45] a refused join says why", async () => {
    fakeApi({ [JOIN]: () => refuse("MEETING_LOCKED", 409) });
    open("Pat Lee");
    await userEvent.click(screen.getByRole("button", { name: "Join now" }));
    expect(await screen.findByText(/This meeting is locked/)).toBeInTheDocument();
  });

  it("TC-F02-90 [AC-F02-45] when MeetApp can't be reached it says so, with Retry", async () => {
    fakeApi({
      [JOIN]: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    open("Pat Lee");
    await userEvent.click(screen.getByRole("button", { name: "Join now" }));
    expect(await screen.findByText("Can't reach MeetApp. Check your connection.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("TC-F02-90 [AC-F02-45] with no meeting to join it offers Cancel instead of an empty screen", () => {
    fakeApi();
    renderWithApp(<PreJoinPage meeting={undefined} userName="Pat Lee" onCancel={vi.fn()} onJoined={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Join a meeting" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});

describe("TC-F02-21 guest name and Terms text on the pre-join", () => {
  it("TC-F02-21 [AC-F02-11] an empty or 61-character name blocks Join now; 1 and 60 characters join", async () => {
    const api = fakeApi({ [JOIN]: () => refuse("MEETING_LOCKED", 409) });
    open();
    expect(screen.getByText("By joining, you agree to the Terms and the Privacy Policy.")).toBeInTheDocument();
    expect(document.querySelector("a")).toBeNull();
    const name = screen.getByRole("textbox", { name: "Your name" });
    const join = screen.getByRole("button", { name: "Join now" });
    await userEvent.click(join);
    expect(await screen.findByText("Type a name of 1 to 60 characters.")).toBeInTheDocument();
    await userEvent.type(name, "a".repeat(61));
    await userEvent.click(join);
    expect(api.callsTo("POST", "/api/v1/meetings/join")).toHaveLength(0);
    await userEvent.clear(name);
    await userEvent.type(name, "a");
    await userEvent.click(join);
    await vi.waitFor(() => expect(api.callsTo("POST", "/api/v1/meetings/join")).toHaveLength(1));
    await userEvent.clear(name);
    await userEvent.type(name, "b".repeat(60));
    await userEvent.click(join);
    await vi.waitFor(() => expect(api.callsTo("POST", "/api/v1/meetings/join")).toHaveLength(2));
    expect(api.callsTo("POST", "/api/v1/meetings/join")[1]?.body).toMatchObject({ guestName: "b".repeat(60) });
  });
});
