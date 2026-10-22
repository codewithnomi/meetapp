// The app's side of the live line (D064; F14 design.md 3.4): one WebSocket while the app is open. It
// pings every 30 seconds, reconnects with growing waits (1, 2, 4… up to 30 seconds), and tells its
// listeners when it (re)connects, so open chats catch up from their last news number and the list reloads.
// It sends only typing, active and ping; everything else uses normal requests.
import { lineServerMessageSchema, type LineAppMessage, type LineServerMessage } from "@meetapp/contracts";

const PING_MS = 30_000;
const MAX_WAIT_MS = 30_000;

export interface LineSocket {
  readyState: number;
  send: (data: string) => void;
  close: () => void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
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
    socket.onopen = () => {
      this.attempt = 0;
      this.emit({ t: "connected" });
      this.schedulePing();
    };
    socket.onmessage = (event) => {
      const parsed = lineServerMessageSchema.safeParse(safeJson(event.data));
      if (parsed.success) this.emit(parsed.data);
    };
    socket.onclose = () => {
      this.clear(this.pinger);
      if (this.stopped) return;
      // 1, 2, 4… seconds, at most 30.
      const wait = Math.min(MAX_WAIT_MS, 1000 * 2 ** this.attempt);
      this.attempt += 1;
      this.retry = this.timer(() => this.connect(), wait);
    };
  }

  private schedulePing() {
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
    this.socket?.close();
  }
}

function safeJson(data: unknown): unknown {
  try {
    return JSON.parse(String(data));
  } catch {
    return undefined;
  }
}
