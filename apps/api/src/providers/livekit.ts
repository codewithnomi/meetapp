// The call server, LiveKit (F02 design.md sections 3.5–3.7, D054). The backend decides who gets in;
// LiveKit enforces it. Rooms are made only here (the server is set to make none itself). A pass is for one
// room, valid 10 minutes for the first connection, and carries only the role's rights (S4, AC-F02-49).
// Shared state (role, group, hand; options, lock) is set only here, never by the apps.
import {
  AccessToken,
  DataPacket_Kind,
  RoomServiceClient,
  TrackSource,
  WebhookReceiver,
  type ParticipantInfo,
  type WebhookEvent,
} from "livekit-server-sdk";
import { callServerAdminUrl, type Config } from "../config/config.ts";

const PASS_TTL = "10m";
/** How long an empty room stays open (also set in infra/livekit.yaml). */
const EMPTY_ROOM_SECONDS = 30;
const MAX_PARTICIPANTS = 100;
/** Server messages the apps trust (design.md 3.6): only ones sent here, never by a participant. */
const CONTROL_TOPIC = "meetapp.control";
/** Chat news (F03 design 3.4): apps trust only packets the server sent, never a participant's. */
const CHAT_TOPIC = "meetapp.chat";

export type MediaSource = "camera" | "microphone" | "screen_share";

const SOURCES: Record<MediaSource, TrackSource> = {
  camera: TrackSource.CAMERA,
  microphone: TrackSource.MICROPHONE,
  screen_share: TrackSource.SCREEN_SHARE,
};

export interface PassRequest {
  room: string;
  /** The attendance id. */
  identity: string;
  name: string;
  sources: MediaSource[];
  attributes: Record<string, string>;
}

/** The rights a participant has (the same in a pass and in a later change). */
function rights(sources: MediaSource[]) {
  return {
    canSubscribe: true,
    canPublish: sources.length > 0,
    canPublishData: true,
    canPublishSources: sources.map((source) => SOURCES[source]),
    canUpdateMetadata: false,
  };
}

/** A pass for one room, valid 10 minutes for the first connection, with the role's rights only. */
function issuePass(config: Config, { room, identity, name, sources, attributes }: PassRequest): Promise<string> {
  const token = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: PASS_TTL,
    attributes,
  });
  const { canUpdateMetadata, ...grant } = rights(sources);
  token.addGrant({ roomJoin: true, room, canUpdateOwnMetadata: canUpdateMetadata, ...grant });
  return token.toJwt();
}

/** Mutes the person's microphone track, if they send one (AC-F02-33). */
async function muteMicrophone(rooms: RoomServiceClient, room: string, identity: string): Promise<boolean> {
  const person = await rooms.getParticipant(room, identity);
  const microphone = person.tracks.find((track) => track.source === TrackSource.MICROPHONE && !track.muted);
  if (!microphone) return false;
  await rooms.mutePublishedTrack(room, identity, microphone.sid, true);
  return true;
}

export function createLiveKitProvider(config: Config) {
  const rooms = new RoomServiceClient(callServerAdminUrl(config), config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);
  const webhooks = new WebhookReceiver(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);

  return {
    rooms,
    ping: async () => {
      await rooms.listRooms();
    },
    /** Makes the room if it doesn't exist; LiveKit returns the existing one otherwise. Chat calls cap it at 25 (F15). */
    ensureRoom: (room: string, metadata: string, maxParticipants = MAX_PARTICIPANTS) =>
      rooms.createRoom({
        name: room,
        emptyTimeout: EMPTY_ROOM_SECONDS,
        departureTimeout: EMPTY_ROOM_SECONDS,
        maxParticipants,
        metadata,
      }),
    pass: (request: PassRequest) => issuePass(config, request),
    /** New rights at once; LiveKit stops tracks the person may no longer send (AC-F02-34, 36). */
    setRights: (room: string, identity: string, sources: MediaSource[]) =>
      rooms.updateParticipant(room, identity, { permission: rights(sources) }),
    setAttributes: (room: string, identity: string, attributes: Record<string, string>) =>
      rooms.updateParticipant(room, identity, { attributes }),
    setRoomMetadata: (room: string, metadata: string) => rooms.updateRoomMetadata(room, metadata),
    /** Disconnects the person; passes issued before now stop working for them (AC-F02-49). */
    remove: (room: string, identity: string) =>
      rooms.removeParticipant(room, identity, { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000)) }),
    muteMicrophone: (room: string, identity: string) => muteMicrophone(rooms, room, identity),
    /** Mutes one screen track (the backend decides who shares, design.md 3.6). */
    muteTrack: (room: string, identity: string, trackSid: string) =>
      rooms.mutePublishedTrack(room, identity, trackSid, true),
    /** A server message to everyone, or to the listed people (by attendance id). */
    sendControl: (room: string, message: object, identities?: string[]) =>
      rooms.sendData(room, new TextEncoder().encode(JSON.stringify(message)), DataPacket_Kind.RELIABLE, {
        topic: CONTROL_TOPIC,
        ...(identities ? { destinationIdentities: identities } : {}),
      }),
    /** Chat news to everyone in the room (F03 design 3.4). */
    sendChat: (room: string, payload: Uint8Array) =>
      rooms.sendData(room, payload, DataPacket_Kind.RELIABLE, { topic: CHAT_TOPIC }),
    participants: (room: string): Promise<ParticipantInfo[]> => rooms.listParticipants(room),
    runningRooms: async (): Promise<string[]> => (await rooms.listRooms()).map((room) => room.name),
    deleteRoom: (room: string) => rooms.deleteRoom(room),
    /** A webhook's event, after checking its signature and body hash; throws when either is wrong. */
    readWebhook: (body: string, authorization: string | undefined): Promise<WebhookEvent> =>
      webhooks.receive(body, authorization),
  };
}

export type LiveKitProvider = ReturnType<typeof createLiveKitProvider>;
