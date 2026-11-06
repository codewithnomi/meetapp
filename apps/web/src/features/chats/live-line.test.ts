// The live line's app side (F14 design 3.4, AC-F14-20): reconnects with growing waits, tells listeners
// when it (re)connects so chats catch up, passes on only valid messages, and pings.
import { describe, expect, it } from "vitest";
import { LiveLine, type LineSocket } from "./live-line.ts";

function setUp(more: { now?: () => number; maxWaitMs?: number } = {}) {
  const sockets: (LineSocket & { sent: string[] })[] = [];
  const timers: { run: () => void; ms: number; cleared?: boolean }[] = [];
  const line = new LiveLine({
    url: "ws://127.0.0.1:3000/api/v1/realtime",
    ...more,
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
    // F04: one ping on opening (it tells the server's time), then one every 30 seconds.
    expect(must(sockets[0]).sent).toEqual([JSON.stringify({ t: "ping" })]);
    must(timers.find((timer) => timer.ms === 30_000)).run();
    expect(must(sockets[0]).sent).toEqual([JSON.stringify({ t: "ping" }), JSON.stringify({ t: "ping" })]);
  });

  it("TC-F04-53 [AC-F04-31] a pong with the server's time gives the server's clock, whatever this computer's says", () => {
    let clock = 1_000_000;
    const { line, sockets } = setUp({ now: () => clock });
    line.start();
    opened(must(sockets[0]));
    clock += 200;
    // The server's clock is 10 minutes ahead; the answer took 200 ms there and back.
    must(sockets[0]).onmessage?.({ data: JSON.stringify({ t: "pong", at: 1_000_100 + 600_000 }) });
    expect(line.serverNow()).toBe(clock + 600_000);
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

  it("TC-F04-74 [AC-F04-38] in the desktop app the wait between tries never passes 8 s", () => {
    const { line, sockets, timers } = setUp({ maxWaitMs: 8_000 });
    line.start();
    for (let i = 0; i < 6; i++) {
      must(sockets.at(-1)).onclose?.({ code: 1006 });
      must(timers.at(-1)).run();
    }
    expect(timers.map((timer) => timer.ms)).toEqual([1_000, 2_000, 4_000, 8_000, 8_000, 8_000]);
  });

  it("TC-F04-73 TC-F04-74 [AC-F04-38] waking up or the network coming back opens a new line at once", () => {
    const { line, sockets, timers } = setUp();
    line.start();
    opened(must(sockets[0]));
    // The line looks open after sleep: it is replaced at once, and the old one's close changes nothing.
    line.reconnectNow();
    expect(sockets).toHaveLength(2);
    must(sockets[0]).onclose?.({ code: 1006 });
    expect(sockets).toHaveLength(2);
    // A line waiting to try again (the wait has grown) doesn't wait.
    must(sockets[1]).onclose?.({ code: 1006 });
    const waiting = must(timers.at(-1));
    line.reconnectNow();
    expect(sockets).toHaveLength(3);
    expect((waiting as { cleared?: boolean }).cleared).toBe(true);
    line.stop();
    line.reconnectNow();
    expect(sockets).toHaveLength(3);
  });
});
