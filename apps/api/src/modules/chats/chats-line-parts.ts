// The live line's shapes (D064; F14 design.md 3.4): what a server's hub needs, and one open line.
import type { LineServerMessage } from "@meetapp/contracts";
import type { WebSocket } from "@fastify/websocket";
import type { Redis } from "ioredis";
import type { LineControl, LivePublisher } from "./chats-live.ts";
import type { PresenceStore } from "./chats-presence.ts";

export interface LineDeps {
  redis: Redis;
  live: LivePublisher;
  /** The chats the person is in now (accepted members). */
  conversationsOf: (userId: string) => Promise<string[]>;
  person: (userId: string) => Promise<{ name: string; readReceipts: boolean } | undefined>;
  /** Status (AC-F14-26): where lines report activity, and the status service. */
  presence: PresenceStore;
  status: { announce: (userId: string) => Promise<void>; audience: (viewer: string) => Promise<Set<string>> };
  now?: () => number;
  /** F15: rings still sounding for the person, sent when a line opens (TC-F15-44). */
  ringsFor?: (userId: string) => Promise<LineServerMessage[]>;
}

export interface Line {
  id: string;
  userId: string;
  socket: WebSocket;
  stillSignedIn: () => Promise<boolean>;
  conversations: Set<string>;
  name: string;
  readReceipts: boolean;
  lastPing: number;
  typing: number[];
  /** This line's presence writes, one after another, so the "closed" clean-up always comes last. */
  writes: Promise<unknown>;
  /** People whose status this person may see; their status channels are followed. */
  audience: Set<string>;
  activeAt: number;
  locked: boolean;
}

/** The app's message as JSON; not JSON gives undefined, which the schema then refuses (closing the line). */
export function parseJson(data: Buffer): unknown {
  try {
    return JSON.parse(data.toString("utf8"));
  } catch {
    return undefined;
  }
}

/** A message heard on Redis, or undefined when it isn't an object of JSON. */
export function parseRedis(raw: string): LineServerMessage | LineControl | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null ? (value as LineServerMessage | LineControl) : undefined;
  } catch {
    return undefined;
  }
}
