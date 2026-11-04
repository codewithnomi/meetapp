// F04's notification cards in main (design.md 3.4; AC-F04-30): at most 3 at the bottom right, stacked
// above F16's ring windows and never over the mini call window; each goes after 8 s unless the pointer is
// on it; × closes it. At most 10 cards a second from one window. A card's choice goes back only to the
// main window that sent it. Free of Electron (notices-bridge wiring is in call-windows-bridge.ts).
import type { CallWindowAction, CallWindowView, NoticeCard, NoticeChoice } from "@meetapp/contracts";
import { CHOICES, cleanCard } from "./notices-checks.ts";
import { EDGE, GAP, type Display, type Rect } from "./call-windows.ts";

export const NOTICE_WIDTH = 360;
const noticeHeight = (card: NoticeCard) => (card.kind === "lobby" ? 132 : 96);
export const MAX_CARDS = 3;
export const SHOW_MS = 8_000;
const PER_SECOND = 10;

interface NoticeWindow {
  id: number;
  setBounds: (rect: Rect) => void;
  showInactive: () => void;
  close: () => void;
  send: (view: CallWindowView) => void;
}

export interface NoticeDeps {
  open: () => NoticeWindow;
  displays: () => Display[];
  /** The screen for the corner (the one holding the MeetApp window used last). */
  cornerDisplayId: () => number;
  toMain: (mainWindowId: number, action: { name: "noticeChosen"; cardId: string; choice: NoticeChoice }) => void;
  focusMain: (mainWindowId: number) => void;
  now: () => number;
  /** Runs later; the answer cancels it. */
  later: (ms: number, run: () => void) => () => void;
}

interface Shown {
  owner: number;
  card: NoticeCard;
  window: NoticeWindow;
  cancel: (() => void) | undefined;
}

/** Where cards go: up from the corner, above anything F16 shows in that column (TC-F04-48). */
export function layoutNotices(area: Rect, occupied: Rect[], heights: number[]): Rect[] {
  const x = area.x + area.width - EDGE - NOTICE_WIDTH;
  let bottom = area.y + area.height - EDGE;
  for (const rect of occupied)
    if (rect.x < x + NOTICE_WIDTH && x < rect.x + rect.width) bottom = Math.min(bottom, rect.y - GAP);
  return heights.map((height) => {
    const rect = { x, y: Math.max(area.y, bottom - height), width: NOTICE_WIDTH, height };
    bottom -= height + GAP;
    return rect;
  });
}

export class NoticeBoard {
  /** Oldest first: the oldest sits lowest. */
  private shown: Shown[] = [];
  private occupied: Rect[] = [];
  private readonly sent = new Map<number, number[]>();
  private readonly deps: NoticeDeps;

  constructor(deps: NoticeDeps) {
    this.deps = deps;
  }

  /** A main window's card; refused if wrongly shaped or too many this second (TC-F04-89). */
  show(owner: number, value: unknown): void {
    const card = cleanCard(value);
    if (!card || !this.withinRate(owner)) return;
    const same = this.shown.find((s) => s.owner === owner && s.card.id === card.id);
    if (same) {
      // The same card again (merged messages): new words, the timer starts again.
      same.card = card;
      same.window.send({ kind: "notice", card });
      this.startTimer(same);
      return this.place();
    }
    while (this.shown.length >= MAX_CARDS) this.drop(this.shown[0] as Shown);
    const entry: Shown = { owner, card, window: this.deps.open(), cancel: undefined };
    this.shown.push(entry);
    entry.window.send({ kind: "notice", card });
    this.place();
    entry.window.showInactive();
    this.startTimer(entry);
  }

  /** A main window takes its card back (read elsewhere, signed out). */
  remove(owner: number, cardId: string): void {
    const entry = this.shown.find((s) => s.owner === owner && s.card.id === cardId);
    if (entry) this.drop(entry);
  }

  /** A main window is gone or signed out: its cards go. */
  dropOwner(owner: number): void {
    for (const entry of this.shown.filter((s) => s.owner === owner)) this.drop(entry);
  }

  /** A press in a card's own window; anything else is ignored (TC-F04-90). */
  act(senderId: number, action: CallWindowAction): void {
    const entry = this.shown.find((s) => s.window.id === senderId);
    if (!entry) return;
    if (action.name === "noticeHover") {
      if (action.on) {
        entry.cancel?.();
        entry.cancel = undefined;
      } else this.startTimer(entry);
      return;
    }
    if (action.name !== "notice") return;
    if (action.choice === "close") return this.drop(entry);
    if (!CHOICES[entry.card.kind].includes(action.choice)) return;
    // Admit acts in place; opening a chat or the lobby brings the window forward.
    if (action.choice !== "admit") this.deps.focusMain(entry.owner);
    this.deps.toMain(entry.owner, { name: "noticeChosen", cardId: entry.card.id, choice: action.choice });
    this.drop(entry);
  }

  /** F16's windows moved or changed: cards keep clear of them. */
  avoid(rects: Rect[]): void {
    this.occupied = rects;
    this.place();
  }

  /** A card window closed by itself. */
  closed(id: number): void {
    const entry = this.shown.find((s) => s.window.id === id);
    if (!entry) return;
    entry.cancel?.();
    this.shown = this.shown.filter((s) => s !== entry);
    this.place();
  }

  windowIds(): Set<number> {
    return new Set(this.shown.map((s) => s.window.id));
  }

  private withinRate(owner: number): boolean {
    const now = this.deps.now();
    const recent = (this.sent.get(owner) ?? []).filter((at) => now - at < 1_000);
    if (recent.length >= PER_SECOND) return false;
    this.sent.set(owner, [...recent, now]);
    return true;
  }

  private startTimer(entry: Shown): void {
    entry.cancel?.();
    entry.cancel = this.deps.later(SHOW_MS, () => this.drop(entry));
  }

  private drop(entry: Shown): void {
    entry.cancel?.();
    entry.window.close();
    this.shown = this.shown.filter((s) => s !== entry);
    this.place();
  }

  private place(): void {
    const displays = this.deps.displays();
    const corner = displays.find((d) => d.id === this.deps.cornerDisplayId()) ?? displays[0];
    if (!corner) return;
    const rects = layoutNotices(
      corner.workArea,
      this.occupied,
      this.shown.map((s) => noticeHeight(s.card)),
    );
    this.shown.forEach((entry, index) => {
      const rect = rects[index];
      if (rect) entry.window.setBounds(rect);
    });
  }
}
