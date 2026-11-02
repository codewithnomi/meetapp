// The live line's app side (F14 design 3.4, AC-F14-20): reconnects with growing waits, tells listeners
// when it (re)connects so chats catch up, passes on only valid messages, and pings.
import { describe, expect, it } from "vitest";
import { LiveLine, type LineSocket } from "./live-line.ts";

function setUp() {
  const sockets: (LineSocket & { sent: string[] })[] = [];
  const timers: { run: () => void; ms: number; cleared?: boolean }[] = [];
  const line = new LiveLine({
    url: "ws://127.0.0.1:3000/api/v1/realtime",
    open: () => {
      const socket = {
        readyState: 0,
        sent: [] as string[],
        send(data: string) {
          socket.sent.push(data);
        },
        close() {
          socket.readyState = 3;
        },
        onopen: null as (() => void) | null,
        onmessage: null as ((event: { data: unknown }) => void) | null,
        onclose: null as ((event: { code: number }) => void) | null,
      };
      sockets.push(socket);
      return socket;
    },
    setTimer: (run, ms) => {
      const timer = { run, ms };
      timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => {
      (timer as { cleared?: boolean }).cleared = true;
    },
  });
  return { line, sockets, timers };
}

/** The item, or a failed test when it isn't there. */
function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("missing in the test");
  return value;
}

const opened = (socket: LineSocket) => {
  socket.readyState = 1;
  socket.onopen?.();
};

describe("the live line in the app", () => {
  it("TC-F14-41 [AC-F14-20] reconnects after 1, 2, 4… seconds and says when it's back", () => {
    const { line, sockets, timers } = setUp();
    const heard: string[] = [];
    line.listen((message) => heard.push(message.t));
    line.start();
    opened(must(sockets[0]));
    expect(heard).toEqual(["connected"]);
    for (const expected of [1000, 2000, 4000]) {
      must(sockets.at(-1)).onclose?.({ code: 1006 });
      const wait = must(timers.filter((timer) => timer.ms !== 30_000).at(-1));
      expect(wait.ms).toBe(expected);
      wait.run();
    }
    opened(must(sockets.at(-1)));
    expect(heard).toEqual(["connected", "connected"]);
  });

  it("TC-F14-41 [AC-F14-20] passes on valid messages only, and pings every 30 seconds", () => {
    const { line, sockets, timers } = setUp();
    const heard: unknown[] = [];
    line.listen((message) => heard.push(message));
    line.start();
    opened(must(sockets[0]));
    must(sockets[0]).onmessage?.({ data: JSON.stringify({ t: "pong" }) });
    must(sockets[0]).onmessage?.({ data: "{broken" });
    must(sockets[0]).onmessage?.({ data: JSON.stringify({ t: "unknown" }) });
    expect(heard).toEqual([{ t: "connected" }, { t: "pong" }]);
    must(timers.find((timer) => timer.ms === 30_000)).run();
    expect(must(sockets[0]).sent).toEqual([JSON.stringify({ t: "ping" })]);
  });

  it("TC-F14-41 [AC-F14-20] stays closed when replaced by a 6th window, refused, or signed out", () => {
    for (const code of [4001, 4400, 4401]) {
      const { line, sockets, timers } = setUp();
      line.start();
      opened(must(sockets[0]));
      must(sockets[0]).onclose?.({ code });
      expect(timers.filter((timer) => timer.ms !== 30_000)).toEqual([]);
      expect(sockets).toHaveLength(1);
      // Signing in again starts a new line.
      line.start();
      expect(sockets).toHaveLength(2);
    }
  });

  it("TC-F14-41 [AC-F14-20] an old socket's close changes nothing, and only one ping timer runs", () => {
    const { line, sockets, timers } = setUp();
    line.start();
    opened(must(sockets[0]));
    must(sockets[0]).onclose?.({ code: 1006 });
    must(timers.find((timer) => timer.ms === 1000)).run();
    opened(must(sockets[1]));
    const live = timers.filter((timer) => timer.ms === 30_000 && !timer.cleared);
    expect(live).toHaveLength(1);
    // The first socket closing late neither clears the new ping nor reconnects.
    must(sockets[0]).onclose?.({ code: 1006 });
    expect(must(live[0]).cleared).toBeUndefined();
    expect(sockets).toHaveLength(2);
    // Opening twice still leaves one ping timer.
    opened(must(sockets[1]));
    expect(timers.filter((timer) => timer.ms === 30_000 && !timer.cleared)).toHaveLength(1);
  });
});
