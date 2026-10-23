// The app's side of the live line (D064; F14 design.md 3.4): one WebSocket while the app is open. It
// pings every 30 seconds, reconnects with growing waits (1, 2, 4… up to 30 seconds), and tells its
// listeners when it (re)connects, so open chats catch up from their last news number and the list reloads.
// It sends only typing, active and ping; everything else uses normal requests. It stays closed when the
// server replaced it (4001, a 6th window), refused it (4400) or the person signed out (4401): reconnecting
// then would only push another window out, or fail; signing in again starts a new line.
import { lineServerMessageSchema, type LineAppMessage, type LineServerMessage } from "@meetapp/contracts";

const PING_MS = 30_000;
const MAX_WAIT_MS = 30_000;
/** Close codes after which reconnecting can't help (the server's `CLOSE`). */
const FINAL_CLOSES = new Set([4001, 4400, 4401]);

export interface LineSocket {
  readyState: number;
  send: (data: string) => void;
  close: () => void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
}

export interface LiveLineOptions {
  url: string;
  open: (url: string) => LineSocket;
  /** Timers, replaceable in tests. */
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

export type LineListener = (message: LineServerMessage | { t: "connected" }) => void;

const OPEN = 1;

export class LiveLine {
  private socket: LineSocket | undefined;
  private readonly listeners = new Set<LineListener>();
  private attempt = 0;
  private stopped = false;
  private pinger: unknown;
  private retry: unknown;
  private readonly options: LiveLineOptions;

  constructor(options: LiveLineOptions) {
    this.options = options;
  }

  private timer(run: () => void, ms: number) {
    return (this.options.setTimer ?? ((r, m) => setTimeout(r, m)))(run, ms);
  }

  private clear(timer: unknown) {
    if (timer !== undefined) (this.options.clearTimer ?? ((t) => clearTimeout(t as number)))(timer);
  }

  start() {
    this.stopped = false;
    this.connect();
  }

  private connect() {
    const socket = this.options.open(this.options.url);
    this.socket = socket;
    // An older socket's events are ignored: only the newest one may change timers or reconnect.
    socket.onopen = () => {
      if (socket !== this.socket) return;
      this.attempt = 0;
      this.emit({ t: "connected" });
      this.schedulePing();
    };
    socket.onmessage = (event) => {
      if (socket !== this.socket) return;
      const parsed = lineServerMessageSchema.safeParse(safeJson(event.data));
      if (parsed.success) this.emit(parsed.data);
    };
    socket.onclose = (event) => {
      if (socket !== this.socket) return;
      this.clear(this.pinger);
      this.pinger = undefined;
      if (FINAL_CLOSES.has(event.code)) this.stopped = true;
      if (this.stopped) return;
      // 1, 2, 4… seconds, at most 30.
      const wait = Math.min(MAX_WAIT_MS, 1000 * 2 ** this.attempt);
      this.attempt += 1;
      this.retry = this.timer(() => this.connect(), wait);
    };
  }

  /** One ping timer at a time. */
  private schedulePing() {
    this.clear(this.pinger);
    this.pinger = this.timer(() => {
      this.send({ t: "ping" });
      this.schedulePing();
    }, PING_MS);
  }

  private emit(message: LineServerMessage | { t: "connected" }) {
    for (const listener of this.listeners) listener(message);
  }

  send(message: LineAppMessage) {
    if (this.socket?.readyState === OPEN) this.socket.send(JSON.stringify(message));
  }

  listen(listener: LineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  stop() {
    this.stopped = true;
    this.clear(this.pinger);
    this.clear(this.retry);
    const socket = this.socket;
    this.socket = undefined;
    socket?.close();
  }
}

function safeJson(data: unknown): unknown {
  try {
    return JSON.parse(String(data));
  } catch {
    return undefined;
  }
}
