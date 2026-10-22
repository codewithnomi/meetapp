// The live line's app side (F14 design 3.4, AC-F14-20): reconnects with growing waits, tells listeners
// when it (re)connects so chats catch up, passes on only valid messages, and pings.
import { describe, expect, it } from "vitest";
import { LiveLine, type LineSocket } from "./live-line.ts";

function setUp() {
  const sockets: (LineSocket & { sent: string[] })[] = [];
  const timers: { run: () => void; ms: number }[] = [];
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
        onclose: null as (() => void) | null,
      };
      sockets.push(socket);
      return socket;
    },
    setTimer: (run, ms) => timers.push({ run, ms }),
    clearTimer: () => undefined,
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
      must(sockets.at(-1)).onclose?.();
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
});
