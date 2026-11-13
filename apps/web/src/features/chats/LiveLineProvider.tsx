// Keeps one live line open while someone is signed in (D064) and shares it with the screens. Reports a
// key or mouse action at most once a minute (Available) and a locked computer (Away), from the desktop
// bridge's `power.onLockChange` (AC-F14-26). List news and new messages refresh the chat list.
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFileUrl } from "../api/index.ts";
import { LiveLine, type LineListener, type LineSocket } from "./live-line.ts";

const LineContext = createContext<LiveLine | undefined>(undefined);
/** True while the server can't pass on news from other servers (Redis down): the app checks itself. */
const PollingContext = createContext(false);
const ACTIVE_EVERY_MS = 60_000;

type PowerBridge = { power?: { onLockChange: (listener: (locked: boolean) => void) => () => void } };

function lineUrl(): string {
  return (apiFileUrl("/api/v1/realtime") ?? "").replace(/^http/, "ws");
}

/** Activity and the locked computer, sent on the line (AC-F14-26). */
function useActivity(line: LiveLine) {
  useEffect(() => {
    let last = 0;
    const active = () => {
      if (Date.now() - last < ACTIVE_EVERY_MS) return;
      last = Date.now();
      line.send({ t: "active", active: true });
    };
    window.addEventListener("keydown", active);
    window.addEventListener("pointerdown", active);
    const bridge = (window as { meetapp?: PowerBridge }).meetapp;
    let locked = false;
    // A new line counts as active, so a line opened while the computer is locked says Away again (bug review).
    const unlisten = line.listen((message) => {
      if (message.t === "connected" && locked) line.send({ t: "active", active: false });
    });
    const stop = bridge?.power?.onLockChange((now) => {
      locked = now;
      last = 0;
      // Unlocked or awake again (F04 AC-38): a fresh line first; it reports activity once open.
      if (!now) line.reconnectNow();
      line.send({ t: "active", active: !now });
    });
    // The network is back: reconnect now rather than at the next try (F04 AC-38).
    const online = () => line.reconnectNow();
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("keydown", active);
      window.removeEventListener("pointerdown", active);
      window.removeEventListener("online", online);
      unlisten();
      stop?.();
    };
  }, [line]);
}

export function LiveLineProvider({ children }: { children: ReactNode }) {
  const queries = useQueryClient();
  const [polling, setPolling] = useState(false);
  const [line] = useState(
    () =>
      new LiveLine({
        url: lineUrl(),
        open: (url) => new WebSocket(url) as unknown as LineSocket,
        // F04 AC-38: in the desktop app, never more than 8 s between tries, so it is back within 10 s.
        ...("meetapp" in window ? { maxWaitMs: 8_000 } : {}),
      }),
  );
  useEffect(() => {
    line.start();
    const stop = line.listen((message) => {
      if (message.t === "polling") setPolling(message.on);
      // A fresh line starts normal again; the server says so if it still can't pass news on.
      if (message.t === "connected") setPolling(false);
      // The list's order, unread counts and requests change with these (AC-F14-01, 02, 10).
      if (message.t === "list" || message.t === "news" || message.t === "connected" || message.t === "status") {
        void queries.invalidateQueries({ queryKey: ["chats"] });
      }
    });
    return () => {
      stop();
      line.stop();
    };
  }, [line, queries]);
  useActivity(line);
  return (
    <LineContext.Provider value={line}>
      <PollingContext.Provider value={polling}>{children}</PollingContext.Provider>
    </LineContext.Provider>
  );
}

/** Whether the app must check for news itself (TC-F14-44). */
export const usePolling = () => useContext(PollingContext);

/** Listen to the live line while the component is shown. */
export function useLiveLine(listener: LineListener): LiveLine | undefined {
  const line = useContext(LineContext);
  useEffect(() => line?.listen(listener), [line, listener]);
  return line;
}
