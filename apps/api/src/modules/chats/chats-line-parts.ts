// The live line's shapes (D064; F14 design.md 3.4): what a server's hub needs, and one open line.
import type { WebSocket } from "@fastify/websocket";
import type { Redis } from "ioredis";
import type { LivePublisher } from "./chats-live.ts";
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
