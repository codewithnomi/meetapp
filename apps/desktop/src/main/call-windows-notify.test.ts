// The missed-call notification (TC-F16-20, 23, 25, 26, 58; AC-F16-10–13, 23) with a fake Notification.
import { describe, expect, it, vi } from "vitest";
import { notifyMissed, type NotificationKind } from "./call-windows-notify.ts";

const missed = {
  callId: "c1",
  from: "Sara <b>Malik</b>",
  chatName: "Release team",
  kind: "audio" as const,
  conversationId: "k1",
  endedAt: 1,
  text: { title: "Missed call", body: "from Sara <b>Malik</b> in Release team", callBack: "Call back" },
};

function fake(supported = true) {
  const made: { options: unknown; handlers: Record<string, () => void>; shown: boolean }[] = [];
  const Kind = class {
    static isSupported = () => supported;
    handlers: Record<string, () => void> = {};
    shown = false;
    constructor(options: unknown) {
      made.push(this as never);
      (this as unknown as { options: unknown }).options = options;
    }
    on(event: string, listener: () => void) {
      this.handlers[event] = listener;
    }
    show() {
      this.shown = true;
    }
  };
  return { Kind: Kind as unknown as NotificationKind, made };
}

describe("TC-F16-20 TC-F16-23 TC-F16-25 TC-F16-26 TC-F16-58 the missed-call notification", () => {
  it("TC-F16-20 TC-F16-58 [AC-F16-10, AC-F16-23] shows the translated words and names only, with Call back", () => {
    const { Kind, made } = fake();
    notifyMissed(missed, Kind, vi.fn());
    expect(made).toHaveLength(1);
    expect(made[0]?.options).toEqual({
      title: "Missed call",
      body: "from Sara <b>Malik</b> in Release team",
      actions: [{ type: "button", text: "Call back" }],
    });
    expect(made[0]?.shown).toBe(true);
  });

  it("TC-F16-23 TC-F16-25 [AC-F16-11] Call back calls back the same way; a click opens the chat", () => {
    const { Kind, made } = fake();
    const onAction = vi.fn();
    notifyMissed(missed, Kind, onAction);
    made[0]?.handlers["action"]?.();
    made[0]?.handlers["click"]?.();
    expect(made[0]?.handlers["close"]).toBeDefined();
    expect(onAction.mock.calls).toEqual([
      [{ name: "callBack", conversationId: "k1", video: false }],
      [{ name: "openChat", conversationId: "k1" }],
    ]);
  });

  it("TC-F16-26 [AC-F16-13] notifications refused or unsupported: nothing happens", () => {
    const { Kind, made } = fake();
    const onAction = vi.fn();
    notifyMissed(missed, Kind, onAction);
    expect(() => made[0]?.handlers["failed"]?.()).not.toThrow();
    expect(onAction).not.toHaveBeenCalled();
    const off = fake(false);
    notifyMissed(missed, off.Kind, onAction);
    expect(off.made).toHaveLength(0);
  });
});
