// F04's notification cards in main (TC-F04-48, 49, 89, 90; AC-F04-30): placing, timing, the card check
// and who may act, with a fake computer.
import type { CallWindowView } from "@meetapp/contracts";
import { describe, expect, it } from "vitest";
import { MAX_CARDS, NOTICE_WIDTH, NoticeBoard, SHOW_MS, layoutNotices, type NoticeDeps } from "./notices.ts";
import { cleanCard } from "./notices-checks.ts";

const AREA = { x: 0, y: 0, width: 1440, height: 900 };

function fakeComputer() {
  let clock = 0;
  let nextId = 100;
  const timers: { at: number; run: () => void; live: boolean }[] = [];
  const windows: {
    id: number;
    bounds?: unknown;
    shown: boolean;
    closed: boolean;
    views: CallWindowView[];
    focused: boolean;
  }[] = [];
  const toMain: unknown[] = [];
  const focused: number[] = [];
  const deps: NoticeDeps = {
    open: () => {
      const w: (typeof windows)[number] = { id: nextId++, shown: false, closed: false, views: [], focused: false };
      windows.push(w);
      return {
        id: w.id,
        setBounds: (rect) => (w.bounds = rect),
        showInactive: () => (w.shown = true),
        close: () => (w.closed = true),
        send: (view) => w.views.push(view),
      };
    },
    displays: () => [{ id: 1, workArea: AREA }],
    cornerDisplayId: () => 1,
    toMain: (id, action) => toMain.push([id, action]),
    focusMain: (id) => focused.push(id),
    now: () => clock,
    later: (ms, run) => {
      const timer = { at: clock + ms, run, live: true };
      timers.push(timer);
      return () => (timer.live = false);
    },
  };
  const advance = (ms: number) => {
    clock += ms;
    for (const timer of timers) {
      if (!timer.live || timer.at > clock) continue;
      timer.live = false;
      timer.run();
    }
  };
  return { deps, windows, toMain, focused, advance, open: () => windows.filter((w) => !w.closed) };
}

const card = (id: string, more: Record<string, unknown> = {}) => ({
  id,
  kind: "message",
  title: "Sara Malik",
  detail: "Release team",
  text: "Hello",
  close: "Close",
  ...more,
});

describe("notice cards", () => {
  it("TC-F04-48 [AC-F04-30] stack up from the corner, above F16's windows, at most 3; shown without focus", () => {
    const computer = fakeComputer();
    const board = new NoticeBoard(computer.deps);
    for (const id of ["a", "b", "c", "d", "e"]) {
      computer.advance(200);
      board.show(1, card(id));
    }
    expect(computer.open()).toHaveLength(MAX_CARDS);
    // The oldest went first: a and b are closed.
    expect(computer.windows.slice(0, 2).every((w) => w.closed)).toBe(true);
    expect(computer.open().every((w) => w.shown && !w.focused)).toBe(true);
    const placed = computer.open().map((w) => w.bounds as { x: number; y: number; height: number });
    expect(placed[0]).toEqual({ x: 1440 - 16 - NOTICE_WIDTH, y: 900 - 16 - 96, width: NOTICE_WIDTH, height: 96 });
    expect((placed[1]?.y ?? 0) + 96 + 8).toBe(placed[0]?.y);
    // A ring and the mini window in the corner: the cards go above them.
    const ring = { x: 1440 - 16 - 320, y: 900 - 16 - 160, width: 320, height: 160 };
    const mini = { x: 1440 - 16 - 320, y: ring.y - 8 - 256, width: 320, height: 256 };
    board.avoid([ring, mini]);
    const above = computer.open().map((w) => w.bounds as { y: number; height: number });
    expect(above.every((rect) => rect.y + rect.height <= mini.y - 8)).toBe(true);
    expect(layoutNotices(AREA, [{ x: 0, y: 0, width: 100, height: 900 }], [96])[0]?.y).toBe(900 - 16 - 96);
  });

  it("TC-F04-49 [AC-F04-30] go after 8 s; the pointer pauses it until 8 s after leaving; × closes at once", () => {
    const computer = fakeComputer();
    const board = new NoticeBoard(computer.deps);
    board.show(1, card("a"));
    computer.advance(SHOW_MS - 1);
    expect(computer.open()).toHaveLength(1);
    computer.advance(1);
    expect(computer.open()).toHaveLength(0);

    board.show(1, card("b"));
    const id = computer.open()[0]?.id ?? 0;
    computer.advance(5_000);
    board.act(id, { name: "noticeHover", on: true });
    computer.advance(15_000);
    expect(computer.open()).toHaveLength(1);
    board.act(id, { name: "noticeHover", on: false });
    computer.advance(SHOW_MS - 1);
    expect(computer.open()).toHaveLength(1);
    computer.advance(1);
    expect(computer.open()).toHaveLength(0);

    // New words in a card under the pointer don't start its timer.
    board.show(1, card("m"));
    const merged = computer.open()[0]?.id ?? 0;
    board.act(merged, { name: "noticeHover", on: true });
    board.show(1, card("m", { text: "Two" }));
    computer.advance(SHOW_MS * 2);
    expect(computer.open()).toHaveLength(1);
    board.act(merged, { name: "notice", choice: "close" });

    board.show(1, card("c"));
    board.act(computer.open()[0]?.id ?? 0, { name: "notice", choice: "close" });
    expect(computer.open()).toHaveLength(0);
    // × tells the page, so its next message makes a new card.
    expect(computer.toMain.at(-1)).toEqual([1, { name: "noticeChosen", cardId: "c", choice: "close" }]);
  });

  it("TC-F04-89 [AC-F04-30, AC-F04-31] bad cards are refused, long words cut, 10 a second at most", () => {
    const refused = [
      card("a", { kind: "ad" }),
      card("a", { extra: 1 }),
      card("a", { person: { name: "S", initials: "S", photo: "data:image/svg+xml;base64,AAAA" } }),
      card("a", { person: { name: "S", initials: "S", photo: `data:image/png;base64,${"A".repeat(400_100)}` } }),
      card("a", { person: { name: "S", initials: "S", photo: "javascript:alert(1)" } }),
      card("a", { person: { name: "S", initials: "S", photo: "file:///etc/passwd" } }),
      card("a", { kind: "lobby" }),
      card("a", { text: 5 }),
      { id: "", kind: "message", title: "x", close: "Close" },
      "<script>",
    ];
    for (const value of refused) expect(cleanCard(value), JSON.stringify(value).slice(0, 80)).toBeUndefined();
    const long = cleanCard(card("a", { text: "x".repeat(5_000), title: "<b>".repeat(500) }));
    expect(long?.text).toHaveLength(100);
    expect(long?.title).toHaveLength(80);

    const computer = fakeComputer();
    const board = new NoticeBoard(computer.deps);
    for (let i = 0; i < 50; i++) board.show(1, card(`m${String(i)}`));
    expect(computer.windows).toHaveLength(10);
  });

  it("TC-F04-90 [AC-F04-30, AC-F04-34] only a card's own window acts, and only back to the window that sent it", () => {
    const computer = fakeComputer();
    const board = new NoticeBoard(computer.deps);
    board.show(7, card("msg"));
    board.show(8, card("lobby", { kind: "lobby", admit: "Admit", viewLobby: "View lobby" }));
    const [messageWindow, lobbyWindow] = computer.open();
    // Another window (a main window, a call page) can't press a card's buttons.
    board.act(999, { name: "notice", choice: "open" });
    // A message card has no Admit.
    board.act(messageWindow?.id ?? 0, { name: "notice", choice: "admit" });
    expect(computer.toMain).toEqual([]);
    board.act(lobbyWindow?.id ?? 0, { name: "notice", choice: "admit" });
    expect(computer.toMain).toEqual([[8, { name: "noticeChosen", cardId: "lobby", choice: "admit" }]]);
    expect(computer.focused).toEqual([]);
    board.act(messageWindow?.id ?? 0, { name: "notice", choice: "open" });
    expect(computer.toMain[1]).toEqual([7, { name: "noticeChosen", cardId: "msg", choice: "open" }]);
    expect(computer.focused).toEqual([7]);
  });
});
