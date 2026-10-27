// The call (F02 design.md sections 3.5, 3.6, 3.8): connects to the call server with the pass from
// joining, publishes the camera and microphone as chosen on the pre-join, plays everyone's sound, and
// keeps the list of people up to date. Settings: adaptive stream (each video only while visible, at its
// shown size), dynacast and simulcast; LiveKit retries a lost connection for 30 seconds in total.
// Reactions come from people on "meetapp.reaction"; "meetapp.control" is trusted only from the server.
import { Room, RoomEvent, Track, type DisconnectReason, type Participant, type RemoteTrack } from "livekit-client";
import { useEffect, useMemo, useState } from "react";
import type { ChatEvent } from "@meetapp/contracts";
import type { DevicePrefs } from "../../devices/index.ts";
import type { Joined } from "../visit.ts";
import { inOrder, personOf } from "./people.ts";
import { REACTION_TOPIC, createGate, decodeReaction, encodeReaction, type Reaction } from "./reactions.ts";
import { roomStateOf } from "./room-state.ts";
import { startShare, stopShare } from "./share.ts";

const CONTROL_TOPIC = "meetapp.control";
/** Chat news (F03 design 3.4): trusted only from the server; anything a participant sends is dropped. */
const CHAT_TOPIC = "meetapp.chat";
const RECONNECT_FOR_MS = 30_000;

export type Connection = "connecting" | "connected" | "reconnecting" | "failed";
export interface ControlMessage {
  type: string;
  by?: string;
}

export interface RoomHandlers {
  onReaction: (personId: string, reaction: Reaction) => void;
  onControl: (message: ControlMessage) => void;
  onDisconnected: (reason: DisconnectReason | undefined) => void;
  /** Chat news from the server (F03). */
  onChat?: ((event: ChatEvent) => void) | undefined;
  /** Back after a short drop: chat catches up on what it missed (F03 design 3.4). */
  onReconnected?: (() => void) | undefined;
}

/** A chat packet from the server, or undefined when it isn't one. */
function decodeChat(payload: Uint8Array): ChatEvent | undefined {
  try {
    const value = JSON.parse(new TextDecoder().decode(payload)) as Partial<ChatEvent>;
    return typeof value.seq === "number" && typeof value.type === "string" ? (value as ChatEvent) : undefined;
  } catch {
    return undefined;
  }
}

function newRoom(prefs: DevicePrefs): Room {
  return new Room({
    adaptiveStream: true,
    dynacast: true,
    publishDefaults: { simulcast: true },
    audioCaptureDefaults: {
      noiseSuppression: prefs.noiseSuppression,
      echoCancellation: true,
      ...(prefs.microphoneId ? { deviceId: prefs.microphoneId } : {}),
    },
    videoCaptureDefaults: prefs.cameraId ? { deviceId: prefs.cameraId } : {},
    reconnectPolicy: {
      nextRetryDelayInMs: ({ elapsedMs, retryCount }) =>
        elapsedMs > RECONNECT_FOR_MS ? null : Math.min(1_000 * 2 ** retryCount, 5_000),
    },
  });
}

/** Everyone's sound plays through hidden audio elements; the chosen speakers are set on the room. */
function playAudio(track: RemoteTrack) {
  if (track.kind !== Track.Kind.Audio) return;
  const element = track.attach();
  element.hidden = true;
  document.body.append(element);
}
const stopAudio = (track: RemoteTrack) => track.detach().forEach((element) => element.remove());

function listen(room: Room, bump: () => void, handlers: RoomHandlers, setConnection: (c: Connection) => void) {
  const gate = createGate();
  const changes = [
    RoomEvent.ParticipantConnected,
    RoomEvent.ParticipantDisconnected,
    RoomEvent.TrackSubscribed,
    RoomEvent.TrackUnsubscribed,
    RoomEvent.TrackMuted,
    RoomEvent.TrackUnmuted,
    RoomEvent.LocalTrackPublished,
    RoomEvent.LocalTrackUnpublished,
    RoomEvent.ActiveSpeakersChanged,
    RoomEvent.ParticipantAttributesChanged,
    RoomEvent.ConnectionQualityChanged,
    RoomEvent.ParticipantPermissionsChanged,
    RoomEvent.RoomMetadataChanged,
  ];
  for (const event of changes) room.on(event, bump);
  room.on(RoomEvent.TrackSubscribed, playAudio).on(RoomEvent.TrackUnsubscribed, stopAudio);
  room.on(RoomEvent.Reconnecting, () => setConnection("reconnecting"));
  room.on(RoomEvent.Reconnected, () => {
    setConnection("connected");
    handlers.onReconnected?.();
  });
  room.on(RoomEvent.Disconnected, (reason) => handlers.onDisconnected(reason));
  room.on(RoomEvent.DataReceived, (payload, participant?: Participant, _kind?, topic?: string) => {
    if (topic === REACTION_TOPIC && participant) {
      const reaction = decodeReaction(payload);
      if (reaction && gate(participant.identity)) handlers.onReaction(participant.identity, reaction);
    }
    if (topic === CHAT_TOPIC && !participant) {
      const event = decodeChat(payload);
      if (event) handlers.onChat?.(event);
    }
    if (topic === CONTROL_TOPIC && !participant) {
      try {
        handlers.onControl(JSON.parse(new TextDecoder().decode(payload)) as ControlMessage);
      } catch {
        // Not a message from our backend.
      }
    }
  });
}

/** Connects, then turns on the chosen devices; stops early once `live()` says this connection was closed. */
async function connect(room: Room, visit: Joined, prefs: DevicePrefs, live: () => boolean) {
  if (!visit.call) throw new Error("no call");
  await room.connect(visit.call.serverUrl, visit.call.pass);
  if (!live()) return;
  if (prefs.speakerId) await room.switchActiveDevice("audiooutput", prefs.speakerId).catch(() => false);
  // A device that fails (missing, refused, not allowed for attendees) just stays off.
  await room.localParticipant.setMicrophoneEnabled(prefs.microphoneOn).catch(() => undefined);
  await room.localParticipant.setCameraEnabled(prefs.cameraOn).catch(() => undefined);
}

/** What the backend lets this person send (LiveKit's TrackSource: 1 camera, 2 microphone, 3 screen). */
function allowedSources(room: Room | undefined) {
  // Until the call answers, nothing is refused yet.
  const sources = room?.localParticipant.permissions?.canPublishSources;
  const may = (source: number) => !sources || sources.includes(source);
  return { microphone: may(2), camera: may(1), screen: may(3) };
}

interface RoomSetters {
  bump: () => void;
  setRoom: (room: Room) => void;
  setConnection: (connection: Connection) => void;
}

/**
 * A new connection each time; returns its clean-up. A connection being closed never touches the next one
 * (React may start the screen twice in development, and Rejoin starts a new one).
 */
function startRoom(visit: Joined, prefs: DevicePrefs, handlers: RoomHandlers, set: RoomSetters): () => void {
  const current = newRoom(prefs);
  let live = true;
  listen(current, set.bump, handlers, set.setConnection);
  set.setRoom(current);
  void connect(current, visit, prefs, () => live)
    .then(() => {
      if (!live) return;
      set.setConnection("connected");
      set.bump();
    })
    .catch(() => {
      if (!live) return;
      // Never connected (call server unreachable, pass refused): ask the backend what happened, as after
      // a lost connection, so the person sees a message and Rejoin instead of an empty screen.
      set.setConnection("failed");
      handlers.onDisconnected(undefined);
    });
  return () => {
    live = false;
    current.removeAllListeners();
    void current.disconnect();
  };
}

export function useMeetingRoom(visit: Joined, prefs: DevicePrefs, handlers: RoomHandlers) {
  const [room, setRoom] = useState<Room>();
  const [version, setVersion] = useState(0);
  const [connection, setConnection] = useState<Connection>("connecting");
  const bump = () => setVersion((v) => v + 1);
  useEffect(
    () => startRoom(visit, prefs, handlers, { bump, setRoom, setConnection }),
    // Connect once per visit; handlers and prefs are read at that moment.
    [visit.attendanceId],
  );
  const people = useMemo(
    () => (room ? inOrder([room.localParticipant, ...room.remoteParticipants.values()].map(personOf)) : []),
    // `version` changes on every room event, so the list is read again then.
    [room, version],
  );
  return {
    room,
    people,
    connection,
    may: allowedSources(room),
    state: roomStateOf(room?.metadata),
    /** Share the source chosen in our picker (or, in a browser, the browser's own choice). */
    share: async (sourceId: string | undefined) => (room ? (await startShare(room, sourceId), bump()) : undefined),
    stopShare: async () => (room ? (await stopShare(room), bump()) : undefined),
    setMicrophone: async (on: boolean) => (await room?.localParticipant.setMicrophoneEnabled(on), bump()),
    setCamera: async (on: boolean) => (await room?.localParticipant.setCameraEnabled(on), bump()),
    sendReaction: async (reaction: Reaction) =>
      room?.localParticipant.publishData(encodeReaction(reaction), { reliable: true, topic: REACTION_TOPIC }),
  };
}
