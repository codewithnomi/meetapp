// F04 T6: a meeting link clicked on the computer (through a fake desktop bridge) is looked up exactly as
// a typed link: the pre-join screen or F02's messages, never a join (TC-F04-27, 29, 30).
import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { useMeetingLinks } from "../../features/desktop-app/index.ts";
import { fakeApi, json, refuse } from "../../features/workspaces/fake-api.ts";
import { JoinMeetingPage } from "./JoinMeetingPage.tsx";

const LOOKUP = "POST /api/v1/meeting-lookups";
const CODE = "AbCdEfGhIjKlMnOpQrSt_-";
let click: ((code: string) => void) | undefined;

function Listening({ children }: { children: React.ReactNode }) {
  useMeetingLinks(() => undefined);
  return children;
}

beforeEach(() => {
  installFakeAuth(null);
  (window as { meetapp?: unknown }).meetapp = {
    app: { onOpenMeeting: (listener: (code: string) => void) => ((click = listener), () => undefined) },
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as { meetapp?: unknown }).meetapp;
});

describe("meeting links in Join a meeting (F04 T6)", () => {
  it("TC-F04-27 TC-F04-30 [AC-F04-10, AC-F04-11] a clicked link is looked up once and opens the pre-join, nothing else is sent", async () => {
    const api = fakeApi({ [LOOKUP]: () => json({ title: "Planning", lookupToken: "t", group: "guest" }) });
    const onFound = vi.fn();
    renderWithApp(
      <Listening>
        <JoinMeetingPage onFound={onFound} onBack={vi.fn()} />
      </Listening>,
    );
    act(() => click?.(CODE));
    await vi.waitFor(() => expect(onFound).toHaveBeenCalledTimes(1));
    expect(api.callsTo("POST", "/api/v1/meeting-lookups").map((c) => (c.body as { link: string }).link)).toEqual([
      `meetapp://m/${CODE}`,
    ]);
    expect(api.calls.filter((c) => !c.path.includes("meeting-lookups") && c.method !== "GET")).toEqual([]);
  });

  it("TC-F04-29 [AC-F04-11] an unknown link shows the same words as typing it", async () => {
    fakeApi({ [LOOKUP]: () => refuse("MEETING_NOT_FOUND", 404) });
    renderWithApp(
      <Listening>
        <JoinMeetingPage onFound={vi.fn()} onBack={vi.fn()} />
      </Listening>,
    );
    act(() => click?.(CODE));
    expect(await screen.findByLabelText("Meeting link")).toHaveValue(`meetapp://m/${CODE}`);
    expect(await screen.findByText(/couldn't find|not found|check the link/i)).toBeInTheDocument();
  });
});
