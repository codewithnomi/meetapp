// F04: what the desktop app's menu-bar or tray menu asks the screens to do (AC-F04-05). The desktop
// preload checks each command; this hook does nothing in a browser.
import { useEffect, useRef } from "react";

type TrayStatus = "available" | "busy" | "dnd" | "brb" | "away";
export type TrayCommand =
  { kind: "settings" } | { kind: "status"; status: TrayStatus } | { kind: "stillRunning"; where: "menuBar" | "tray" };

type AppBridge = { app?: { onTrayCommand: (listener: (command: TrayCommand) => void) => () => void } };

export interface TrayHandlers {
  onSettings?: () => void;
  /** Sets the person's status "until changed" (F04 T8). */
  onStatus?: (status: TrayStatus) => void;
  /** F04: the first close on this computer (AC-04). */
  onStillRunning?: (where: "menuBar" | "tray") => void;
}

export function useTrayCommands(handlers: TrayHandlers): void {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    const bridge = (window as { meetapp?: AppBridge }).meetapp;
    return bridge?.app?.onTrayCommand((command) => {
      if (command.kind === "settings") latest.current.onSettings?.();
      else if (command.kind === "stillRunning") latest.current.onStillRunning?.(command.where);
      else latest.current.onStatus?.(command.status);
    });
  }, []);
}
