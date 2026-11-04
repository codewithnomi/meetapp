import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTrayCommands, type TrayCommand } from "./use-tray-commands.ts";

let send: ((command: TrayCommand) => void) | undefined;
const stop = vi.fn();

function withBridge() {
  (window as { meetapp?: unknown }).meetapp = {
    app: {
      onTrayCommand: (listener: (command: TrayCommand) => void) => {
        send = listener;
        return stop;
      },
    },
  };
}

afterEach(() => {
  delete (window as { meetapp?: unknown }).meetapp;
  send = undefined;
});

describe("tray commands (F04 T4)", () => {
  it("TC-F04-12 [AC-F04-05] Settings in the tray opens Settings; a status choice reaches the status handler", () => {
    withBridge();
    const onSettings = vi.fn();
    const onStatus = vi.fn();
    const { unmount } = renderHook(() => useTrayCommands({ onSettings, onStatus }));
    send?.({ kind: "settings" });
    send?.({ kind: "status", status: "busy" });
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenCalledWith("busy");
    unmount();
    expect(stop).toHaveBeenCalled();
  });

  it("does nothing in a browser (no desktop bridge)", () => {
    expect(() => renderHook(() => useTrayCommands({ onSettings: vi.fn() }))).not.toThrow();
  });
});
