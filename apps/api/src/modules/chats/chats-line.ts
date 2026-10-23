// The live line's server side (D064; F14 design.md 3.4; AC-F14-18, 20, 23, 31, 34). Each API server
// keeps its own open lines, follows the Redis channels of their people's chats and passes on what it
// hears. A line follows only the chats its person is in now: a list change re-reads them (within 2
// seconds). The app may send only `typing`, `active` and `ping`; anything else closes the line. The
// session is checked again every second, so signing out closes the line within 2 seconds.
import { randomUUID } from "node:crypto";
import { CHATS_LIMITS, lineAppMessageSchema, type LineServerMessage } from "@meetapp/contracts";
import type { Redis } from "ioredis";
import type { WebSocket } from "@fastify/websocket";
import { channels, type LineControl } from "./chats-live.ts";
import { OFFLINE_GRACE_MS } from "./chats-status.ts";
import { parseJson, parseRedis, type Line, type LineDeps } from "./chats-line-parts.ts";

export type { LineDeps } from "./chats-line-parts.ts";

export const CLOSE = { invalid: 4400, signedOut: 4401, idle: 4408, replaced: 4001 } as const;
const IDLE_MS = 2 * 60 * 1000;
const CHECK_MS = 1000;
const TYPING = { max: 10, windowMs: 10_000 };

/** Status is worked out again this often for the people with lines here (Away after 5 minutes idle). */
const STATUS_SWEEP_MS = 30 * 1000;

const linesKey = (userId: string) => `meetapp:chats:lines:${userId}`;

/** One server's open lines and the Redis channels they follow. */
class LineHub {
  private readonly subscriber: Redis;
  private readonly lines = new Map<string, Line>();
  private readonly following = new Map<string, Set<Line>>();
  private readonly now: () => number;
  private timer: NodeJS.Timeout | undefined;
  private readonly deps: LineDeps;

  constructor(deps: LineDeps) {
    this.deps = deps;
    this.now = deps.now ?? Date.now;
    // Subscriptions wait for the connection instead of failing while it opens (the shared client
    // refuses commands until it is connected).
    this.subscriber = deps.redis.duplicate({ enableOfflineQueue: true });
    this.subscriber.on("message", (channel: string, raw: string) => {
      this.heard(channel, raw);
    });
    // Without Redis, news from other servers can't arrive: the apps check for themselves meanwhile.
    this.subscriber.on("close", () => {
      this.setPolling(true);
    });
    this.subscriber.on("ready", () => {
      this.setPolling(false);
    });
  }

  private follow(channel: string, line: Line) {
    const set = this.following.get(channel) ?? new Set<Line>();
    if (set.size === 0) void this.subscriber.subscribe(channel);
    set.add(line);
    this.following.set(channel, set);
  }

  private unfollow(channel: string, line: Line) {
    const set = this.following.get(channel);
    if (!set) return;
    set.delete(line);
    if (set.size > 0) return;
    this.following.delete(channel);
    void this.subscriber.unsubscribe(channel);
  }

  /** Reads the person's chats and name again and follows exactly those (AC-F14-18, 34). */
  private async refresh(line: Line) {
    const [ids, me, audience] = await Promise.all([
      this.deps.conversationsOf(line.userId),
      this.deps.person(line.userId),
      this.deps.status.audience(line.userId),
    ]);
    // Closed while reading: following now would leave subscriptions nobody removes.
    if (!this.isOpen(line)) return;
    for (const id of line.audience) if (!audience.has(id)) this.unfollow(channels.status(id), line);
    for (const id of audience) if (!line.audience.has(id)) this.follow(channels.status(id), line);
    line.audience = audience;
    const next = new Set(ids);
    for (const id of line.conversations) if (!next.has(id)) this.unfollow(channels.conversation(id), line);
    for (const id of next) if (!line.conversations.has(id)) this.follow(channels.conversation(id), line);
    line.conversations = next;
    line.name = me?.name ?? line.name;
    line.readReceipts = me?.readReceipts ?? line.readReceipts;
  }

  private isOpen(line: Line) {
    return this.lines.has(line.id);
  }

  private closeLine(line: Line, code: number) {
    if (!this.lines.delete(line.id)) return;
    for (const id of line.conversations) this.unfollow(channels.conversation(id), line);
    for (const id of line.audience) this.unfollow(channels.status(id), line);
    this.unfollow(channels.user(line.userId), line);
    void this.deps.redis.zrem(linesKey(line.userId), line.id);
    this.track(this.inOrder(line, () => this.statusAfterClose(line.userId, line.id)));
    if (line.socket.readyState === line.socket.OPEN) line.socket.close(code);
  }

  private polling = false;

  private setPolling(on: boolean) {
    if (this.stopping || on === this.polling) return;
    this.polling = on;
    for (const line of this.lines.values()) this.send(line, { t: "polling", on });
  }

  private send(line: Line, message: LineServerMessage) {
    if (line.socket.readyState === line.socket.OPEN) line.socket.send(JSON.stringify(message));
  }

  /** What this server hears on Redis, passed to the lines that may have it. */
  private heard(channel: string, raw: string) {
    const message = parseRedis(raw);
    // Something other than our own JSON on our channel: dropped, it can't be passed on safely.
    if (!message) return;
    for (const line of [...(this.following.get(channel) ?? [])]) {
      if ("control" in message) this.controlled(line, message);
      else this.deliver(line, message);
    }
  }

  private controlled(line: Line, control: LineControl) {
    if (control.control === "close" && control.lineId === line.id) this.closeLine(line, CLOSE.replaced);
    if (control.control === "refresh") void this.refresh(line);
  }

  private deliver(line: Line, message: LineServerMessage) {
    // People with read receipts off see no one's (AC-F14-24); one's own marks aren't news.
    if (message.t === "read" && (!line.readReceipts || message.userId === line.userId)) return;
    if (message.t === "list") void this.refresh(line).then(() => this.send(line, message));
    else this.send(line, message);
  }

  private typing(line: Line, conversationId: string) {
    // Only for chats the person is in; extra signals are dropped (AC-F14-23, TC-F14-64, 74).
    if (!line.conversations.has(conversationId)) return;
    const at = this.now();
    line.typing = line.typing.filter((time) => at - time < TYPING.windowMs);
    if (line.typing.length >= TYPING.max) return;
    line.typing.push(at);
    void this.deps.live.typing(conversationId, line.userId, line.name);
  }

  private received(line: Line, data: Buffer) {
    const message = lineAppMessageSchema.safeParse(parseJson(data));
    if (!message.success) {
      this.closeLine(line, CLOSE.invalid);
      return;
    }
    line.lastPing = this.now();
    if (message.data.t === "active") {
      // A key or mouse action, or the computer locked (`active: false`), AC-F14-26.
      line.locked = !message.data.active;
      if (message.data.active) line.activeAt = this.now();
    }
    if (message.data.t !== "typing") this.track(this.reportPresence(line));
    if (message.data.t === "ping") this.send(line, { t: "pong" });
    if (message.data.t === "typing") this.typing(line, message.data.conversationId);
  }

  /** Runs a presence write after this line's earlier ones (a late activity write can't undo "closed"). */
  private inOrder(line: Line, write: () => Promise<unknown>) {
    // An earlier write's failure must not stop later ones; each caller sees its own write's outcome.
    line.writes = line.writes.catch(() => undefined).then(write);
    return line.writes;
  }

  private async reportPresence(line: Line) {
    const seen = { activeAt: line.activeAt, locked: line.locked, seenAt: this.now() };
    await this.inOrder(line, async () => {
      // A line already closed writes nothing more.
      if (!this.lines.has(line.id)) return;
      await this.deps.presence.line(line.userId, line.id, seen);
    });
    await this.deps.status.announce(line.userId);
  }

  /** Offline comes 30 seconds after the last line closed (a grace for reconnects). */
  private async statusAfterClose(userId: string, lineId: string) {
    await this.deps.presence.closed(userId, lineId, this.now());
    // A server shutting down only clears its lines (a crashed one's lines time out: LINE_LOST_MS); the
    // status is worked out again by the servers still running.
    if (this.stopping) return;
    await this.deps.status.announce(userId);
    const later = setTimeout(() => {
      this.waiting.delete(later);
      this.track(this.deps.status.announce(userId));
    }, OFFLINE_GRACE_MS + 1000);
    this.waiting.add(later);
  }

  private stopping = false;
  /** Status work still running, finished before the server's connections close. */
  private readonly running = new Set<Promise<unknown>>();

  private track(work: Promise<unknown>) {
    // Status work is best effort: a failure is fixed by the next sweep (30 s) and mustn't crash the server.
    const done = work.catch(() => undefined).finally(() => this.running.delete(done));
    this.running.add(done);
  }
  private readonly waiting = new Set<NodeJS.Timeout>();

  private lastSweep = 0;

  /** Status changes nobody reports (Away after 5 idle minutes, calls): checked every 30 seconds. */
  private async sweepStatus() {
    if (this.now() - this.lastSweep < STATUS_SWEEP_MS) return;
    this.lastSweep = this.now();
    const people = new Set([...this.lines.values()].map((line) => line.userId));
    for (const userId of people) await this.deps.status.announce(userId);
  }

  /** Session ends and quiet lines: checked every second. */
  private async check() {
    await this.sweepStatus();
    for (const line of [...this.lines.values()]) {
      if (this.now() - line.lastPing > IDLE_MS) this.closeLine(line, CLOSE.idle);
      else if (!(await line.stillSignedIn())) this.closeLine(line, CLOSE.signedOut);
    }
  }

  /** At most 5 lines per person: a 6th closes the oldest, on whichever server it is (code 4001). */
  private async limitLines(line: Line) {
    const key = linesKey(line.userId);
    await this.deps.redis.zadd(key, this.now(), line.id);
    // Closed meanwhile: its id must not count toward the 5 (closeLine's removal may have run first).
    if (!this.isOpen(line)) {
      await this.deps.redis.zrem(key, line.id);
      return;
    }
    const extra = await this.deps.redis.zrange(key, "0", String(-(CHATS_LIMITS.linesPerPerson + 1)));
    for (const old of extra) {
      await this.deps.redis.zrem(key, old);
      await this.deps.live.control(line.userId, { control: "close", lineId: old });
    }
  }

  async open(socket: WebSocket, userId: string, stillSignedIn: () => Promise<boolean>) {
    const line: Line = {
      id: randomUUID(),
      userId,
      socket,
      stillSignedIn,
      conversations: new Set(),
      name: "",
      readReceipts: true,
      lastPing: this.now(),
      typing: [],
      writes: Promise.resolve(),
      audience: new Set(),
      activeAt: this.now(),
      locked: false,
    };
    // Listen at once, so nothing the app sends early is lost.
    socket.on("message", (data: Buffer) => {
      this.received(line, data);
    });
    socket.on("close", () => {
      this.closeLine(line, CLOSE.invalid);
    });
    this.lines.set(line.id, line);
    this.follow(channels.user(userId), line);
    await this.refresh(line);
    await this.limitLines(line);
    if (!this.isOpen(line)) return;
    await this.reportPresence(line);
    if (this.polling) this.send(line, { t: "polling", on: true });
    this.timer ??= setInterval(() => void this.check(), CHECK_MS);
  }

  async close() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    for (const later of this.waiting) clearTimeout(later);
    for (const line of [...this.lines.values()]) this.closeLine(line, CLOSE.signedOut);
    await Promise.all(this.running);
    await this.subscriber.quit();
  }
}

export const createLineHub = (deps: LineDeps) => new LineHub(deps);
