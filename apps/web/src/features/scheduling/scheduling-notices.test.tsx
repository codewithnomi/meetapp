// Meeting cards from the main window (TC-F13-36, 37; AC-F13-17, 21, 22): a due reminder and an invite on
// the live line become cards for the desktop app, following "Meeting invites" and Do not disturb; the
// same reminder twice shows once; Snooze and Dismiss tell the server; another window's dismissal closes
// it; on start, reminders still due show. The app's pieces around it are fake.
import type { NoticeCard } from "@meetapp/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reminderCardId, useSchedulingNotices } from "./scheduling-notices.ts";

const ME = "00000000-0000-4000-8000-000000000001";
const MEETING = "00000000-0000-4000-8000-0000000000b1";
const WS = "00000000-0000-4000-8000-0000000000c1";

const fake = vi.hoisted(() => ({
  line: undefined as ((message: unknown) => void) | undefined,
  settings: { messages: true, mentions: true, lobby: true, sound: true, preview: true, invites: true },
  api: vi.fn(),
  chime: vi.fn(),
}));

vi.mock("../auth/index.ts", () => ({ useSession: () => ({ data: { id: ME } }) }));
vi.mock("../notifications/index.ts", () => ({ useNotificationSettings: () => ({ settings: fake.settings }) }));
vi.mock("../workspaces/index.ts", () => ({ useCurrentWorkspace: () => ({ current: { id: WS } }) }));
vi.mock("../meetings/index.ts", () => ({ useFindMeeting: () => ({ mutate: vi.fn() }) }));
vi.mock("../api/index.ts", () => ({ apiRequest: fake.api }));
vi.mock("../notices/index.ts", () => ({
  chime: fake.chime,
  isQuiet: (mine: { chosen: string | null } | undefined) => mine?.chosen === "dnd",
}));
vi.mock("../chats/index.ts", () => ({
  useLiveLine: (listener: (message: unknown) => void) => {
    fake.line = listener;
    return { serverNow: () => Date.now() };
  },
}));

const shown: NoticeCard[] = [];
const removed: string[] = [];
let press: (action: unknown) => void = () => undefined;

// One clock reading per test, so the same reminder built twice is exactly the same.
let base = Date.now();
const minutes = (n: number) => new Date(base + n * 60_000).toISOString();
const reminder = (kind: "before" | "start" = "before") => ({
  t: "reminder",
  meetingId: MEETING,
  originalStart: minutes(15),
  kind,
  title: "Design review",
  startsAt: kind === "start" ? minutes(0) : minutes(15),
  endsAt: minutes(45),
  allDay: false,
});
const invited = { t: "invited", meetingId: MEETING, title: "Design review", organizerName: "Olivia Owner" };

function Cards({ onJoin, onOpen }: { onJoin: () => void; onOpen: () => void }) {
  useSchedulingNotices({ onJoin, onOpen });
  return null;
}

function start(status?: { chosen: string; until: null }) {
  const client = new QueryClient();
  if (status) client.setQueryData(["me", "status"], status);
  const onJoin = vi.fn();
  const onOpen = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <Cards onJoin={onJoin} onOpen={onOpen} />
    </QueryClientProvider>,
  );
  return { onJoin, onOpen };
}

beforeEach(() => {
  base = Date.now();
  shown.length = 0;
  removed.length = 0;
  fake.settings = { messages: true, mentions: true, lobby: true, sound: true, preview: true, invites: true };
  fake.api.mockResolvedValue({ reminders: [] });
  (window as { meetapp?: unknown }).meetapp = {
    notices: { show: (card: NoticeCard) => shown.push(card), remove: (id: string) => removed.push(id) },
    callWindows: {
      onAction: (listener: (action: unknown) => void) => {
        press = listener;
        return () => undefined;
      },
    },
  };
});
afterEach(() => {
  delete (window as { meetapp?: unknown }).meetapp;
  vi.clearAllMocks();
});

describe("meeting cards", () => {
  it("TC-F13-36 [AC-F13-21] a reminder reads 'Starts in 15 min' or 'Starting now', with Join, Snooze, Dismiss", () => {
    start();
    act(() => fake.line?.(reminder()));
    act(() => fake.line?.(reminder("start")));
    expect(shown[0]).toMatchObject({
      kind: "reminder",
      title: "Design review",
      tag: "Starts in 15 min",
      join: "Join",
      snooze: "Snooze",
      dismiss: "Dismiss",
    });
    expect(shown[1]?.tag).toBe("Starting now");
    expect(fake.chime).toHaveBeenCalledTimes(2);
  });

  it("TC-F13-36 [AC-F13-21] Join, the text, Snooze and Dismiss each do their part", () => {
    const { onJoin, onOpen } = start();
    const choose = (choice: string) => {
      act(() => fake.line?.(reminder()));
      press({ name: "noticeChosen", cardId: shown.at(-1)?.id, choice });
    };
    choose("join");
    expect(onJoin).toHaveBeenCalledWith(MEETING);
    choose("open");
    expect(onOpen).toHaveBeenCalledWith(MEETING, expect.any(String));
    choose("snooze");
    choose("dismiss");
    const bodies = fake.api.mock.calls
      .filter(([url]) => url === "/api/v1/reminders/dismiss")
      .map(([, init]) => (init as { body: { snooze: boolean } }).body.snooze);
    expect(bodies).toEqual([true, false]);
  });

  it("TC-F13-36 [AC-F13-21] dismissed in another window: the card closes", () => {
    start();
    const r = reminder();
    act(() => fake.line?.(r));
    act(() =>
      fake.line?.({ t: "reminder-dismissed", meetingId: r.meetingId, originalStart: r.originalStart, kind: "before" }),
    );
    expect(removed).toEqual([reminderCardId(ME, r)]);
  });

  it("TC-F13-37 [AC-F13-17] an invite card shows only with 'Meeting invites' on", () => {
    start();
    act(() => fake.line?.(invited));
    expect(shown).toEqual([
      expect.objectContaining({ kind: "invite", title: "Olivia Owner", text: "invited you to Design review" }),
    ]);
    fake.settings = { ...fake.settings, invites: false };
    shown.length = 0;
    start();
    act(() => fake.line?.({ ...invited, meetingId: "00000000-0000-4000-8000-0000000000b2" }));
    expect(shown).toEqual([]);
  });

  it("TC-F13-37 [AC-F13-21] Do not disturb: no reminder and no invite", () => {
    start({ chosen: "dnd", until: null });
    act(() => fake.line?.(reminder()));
    act(() => fake.line?.(invited));
    expect(shown).toEqual([]);
  });

  it("TC-F13-37 [AC-F13-21, AC-F13-22] the same reminder twice shows once; on start only those not over show", async () => {
    fake.api.mockResolvedValue({
      reminders: [
        { ...reminder(), t: undefined },
        { ...reminder(), originalStart: minutes(-90), startsAt: minutes(-90), endsAt: minutes(-60), t: undefined },
      ],
    });
    start();
    act(() => fake.line?.(reminder()));
    act(() => fake.line?.({ t: "connected" }));
    await waitFor(() =>
      expect(fake.api).toHaveBeenCalledWith(expect.stringMatching(`/workspaces/${WS}/reminders/due`)),
    );
    await act(async () => Promise.resolve());
    expect(shown).toHaveLength(1);
    // Every card's id carries the person, so the desktop app shows it once across windows (TC-F13-37).
    expect(shown[0]?.id).toContain(ME);
  });
});
