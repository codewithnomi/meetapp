// Keeps one live line open while someone is signed in (D064) and shares it with the screens. Reports a
// key or mouse action at most once a minute (Available) and a locked computer (Away), from the desktop
// bridge's `power.onLockChange` (AC-F14-26). List news and new messages refresh the chat list.
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFileUrl } from "../api/index.ts";
import { LiveLine, type LineListener, type LineSocket } from "./live-line.ts";

const LineContext = createContext<LiveLine | undefined>(undefined);
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
    const stop = bridge?.power?.onLockChange((locked) => {
      last = 0;
      line.send({ t: "active", active: !locked });
    });
    return () => {
      window.removeEventListener("keydown", active);
      window.removeEventListener("pointerdown", active);
      stop?.();
    };
  }, [line]);
}

export function LiveLineProvider({ children }: { children: ReactNode }) {
  const queries = useQueryClient();
  const [line] = useState(
    () => new LiveLine({ url: lineUrl(), open: (url) => new WebSocket(url) as unknown as LineSocket }),
  );
  useEffect(() => {
    line.start();
    const stop = line.listen((message) => {
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
  return <LineContext.Provider value={line}>{children}</LineContext.Provider>;
}

/** Listen to the live line while the component is shown. */
export function useLiveLine(listener: LineListener): LiveLine | undefined {
  const line = useContext(LineContext);
  useEffect(() => line?.listen(listener), [line, listener]);
  return line;
}
