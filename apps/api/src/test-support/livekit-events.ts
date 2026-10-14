// Test helpers for the call server's reports (F02 T7): signed webhook bodies as LiveKit sends them, and
// a call server stand-in that records what the backend asked it to do.
import { createHash, randomUUID } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";
import type { Config } from "../config/config.ts";
import type { LiveKitProvider } from "../providers/livekit.ts";

export interface FakeEvent {
  event: string;
  room: string;
  identity?: string;
  /** Seconds since 1970; defaults to now. */
  at?: number;
  track?: { source: string; sid: string };
  id?: string;
}

export function webhookBody(event: FakeEvent): string {
  return JSON.stringify({
    event: event.event,
    id: event.id ?? `EV_${randomUUID()}`,
    createdAt: String(event.at ?? Math.floor(Date.now() / 1000)),
    room: { name: event.room },
    ...(event.identity ? { participant: { identity: event.identity } } : {}),
    ...(event.track ? { track: event.track } : {}),
  });
}

/** The Authorization header LiveKit sends: a token signed with the API key, carrying the body's hash. */
export async function webhookSignature(config: Config, body: string, secret = config.LIVEKIT_API_SECRET) {
  const token = new AccessToken(config.LIVEKIT_API_KEY, secret);
  token.sha256 = createHash("sha256").update(body).digest("base64");
  return token.toJwt();
}

export interface Recorded {
  removed: string[];
  messages: { room: string; message: object; to?: string[] }[];
  deleted: string[];
}

export interface RoomsSeen {
  /** Rooms the call server has running. */
  rooms?: () => string[];
  /** Who is in a room, by attendance id. */
  people?: (room: string) => string[];
}

/** The real provider for everything else, with removals, messages and room deletions recorded. */
export function recordingLiveKit(real: LiveKitProvider, seen: RoomsSeen = {}) {
  const recorded: Recorded = { removed: [], messages: [], deleted: [] };
  const livekit: LiveKitProvider = {
    ...real,
    remove: async (_room, identity) => {
      recorded.removed.push(identity);
      return undefined as never;
    },
    sendControl: async (room, message, to) => {
      recorded.messages.push({ room, message, ...(to ? { to } : {}) });
    },
    deleteRoom: async (room) => {
      recorded.deleted.push(room);
    },
    participants: async (room) => (seen.people?.(room) ?? []).map((identity) => ({ identity, tracks: [] })) as never,
    runningRooms: async () => seen.rooms?.() ?? [],
  };
  return { livekit, recorded };
}
