// The call (F02 design.md sections 3.5, 3.6, 3.8): connects to the call server with the pass from
// joining, publishes the camera and microphone as chosen on the pre-join, plays everyone's sound, and
// keeps the list of people up to date. Settings: adaptive stream (each video only while visible, at its
// shown size), dynacast and simulcast; LiveKit retries a lost connection for 30 seconds in total.
// Reactions come from people on "meetapp.reaction"; "meetapp.control" is trusted only from the server.
import { Room, RoomEvent, Track, type DisconnectReason, type Participant, type RemoteTrack } from "livekit-client";
import { useEffect, useMemo, useState } from "react";
import type { DevicePrefs } from "../device-prefs.ts";
import type { Joined } from "../visit.ts";
import { inOrder, personOf, type CallPerson } from "./people.ts";
import { REACTION_TOPIC, createGate, decodeReaction, encodeReaction, type Reaction } from "./reactions.ts";

export const CONTROL_TOPIC = "meetapp.control";
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
}

function newRoom(prefs: DevicePrefs): Room {
  return new Room({
    adaptiveStream: true,
    dynacast: true,
    publishDefaults: { simulcast: true },
    audioCaptureDefaults: {
      noiseSuppression: true,
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
  ];
  for (const event of changes) room.on(event, bump);
  room.on(RoomEvent.TrackSubscribed, playAudio).on(RoomEvent.TrackUnsubscribed, stopAudio);
  room.on(RoomEvent.Reconnecting, () => setConnection("reconnecting"));
  room.on(RoomEvent.Reconnected, () => setConnection("connected"));
  room.on(RoomEvent.Disconnected, (reason) => handlers.onDisconnected(reason));
  room.on(RoomEvent.DataReceived, (payload, participant?: Participant, _kind?, topic?: string) => {
    if (topic === REACTION_TOPIC && participant) {
      const reaction = decodeReaction(payload);
      if (reaction && gate(participant.identity)) handlers.onReaction(participant.identity, reaction);
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

async function connect(room: Room, visit: Joined, prefs: DevicePrefs) {
  if (!visit.call) throw new Error("no call");
  await room.connect(visit.call.serverUrl, visit.call.pass);
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

export function useMeetingRoom(visit: Joined, prefs: DevicePrefs, handlers: RoomHandlers) {
  const [room, setRoom] = useState<Room>();
  const [version, setVersion] = useState(0);
  const [connection, setConnection] = useState<Connection>("connecting");
  const bump = () => setVersion((v) => v + 1);
  useEffect(() => {
    // A new connection each time: a connection being closed must never touch the next one (React may
    // start the screen twice in development).
    const current = newRoom(prefs);
    listen(current, bump, handlers, setConnection);
    setRoom(current);
    void connect(current, visit, prefs)
      .then(() => (setConnection("connected"), bump()))
      .catch(() => setConnection("failed"));
    return () => {
      current.removeAllListeners();
      void current.disconnect();
    };
    // Connect once per visit; handlers and prefs are read at that moment.
  }, [visit.attendanceId]);
  const people = useMemo(
    () => (room ? inOrder([room.localParticipant, ...room.remoteParticipants.values()].map(personOf)) : []),
    // `version` changes on every room event, so the list is read again then.
    [room, version],
  );
  return {
    people,
    connection,
    may: allowedSources(room),
    setMicrophone: async (on: boolean) => (await room?.localParticipant.setMicrophoneEnabled(on), bump()),
    setCamera: async (on: boolean) => (await room?.localParticipant.setCameraEnabled(on), bump()),
    sendReaction: async (reaction: Reaction) =>
      room?.localParticipant.publishData(encodeReaction(reaction), { reliable: true, topic: REACTION_TOPIC }),
  };
}

export type MeetingRoom = ReturnType<typeof useMeetingRoom>;
export type { CallPerson };
