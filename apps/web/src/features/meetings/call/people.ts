// The people in the call as the screens need them (F02 design.md section 3.6): name, meeting role and
// group (from the attributes only the backend sets), microphone, camera, speaking, a raised hand and
// the connection. Raised hands come first in the order they went up (AC-F02-23), then the person
// themselves, then everyone else in the order they joined.
import { ConnectionQuality, Track, type Participant, type VideoTrack } from "livekit-client";

export type CallRole = "organizer" | "co_organizer" | "presenter" | "attendee";
type CallGroup = "member" | "external" | "guest";

export interface CallPerson {
  id: string;
  name: string;
  isYou: boolean;
  role: CallRole;
  group: CallGroup;
  userId: string | undefined;
  handRaisedAt: string | undefined;
  micOn: boolean;
  cameraOn: boolean;
  speaking: boolean;
  weak: boolean;
  video: VideoTrack | undefined;
  screen: VideoTrack | undefined;
  joinedAt: number;
}

const ROLES = new Set<string>(["organizer", "co_organizer", "presenter", "attendee"]);
const GROUPS = new Set<string>(["member", "external", "guest"]);

export function personOf(participant: Participant): CallPerson {
  const { role, group, userId, handRaisedAt } = participant.attributes;
  const camera = participant.getTrackPublication(Track.Source.Camera);
  const screen = participant.getTrackPublication(Track.Source.ScreenShare);
  return {
    id: participant.identity,
    name: participant.name ?? "",
    isYou: participant.isLocal,
    role: role && ROLES.has(role) ? (role as CallRole) : "attendee",
    group: group && GROUPS.has(group) ? (group as CallGroup) : "guest",
    userId: userId || undefined,
    handRaisedAt: handRaisedAt || undefined,
    micOn: participant.isMicrophoneEnabled,
    cameraOn: participant.isCameraEnabled,
    speaking: participant.isSpeaking,
    weak:
      participant.connectionQuality === ConnectionQuality.Poor ||
      participant.connectionQuality === ConnectionQuality.Lost,
    video: camera && !camera.isMuted ? (camera.videoTrack ?? undefined) : undefined,
    screen: screen && !screen.isMuted ? (screen.videoTrack ?? undefined) : undefined,
    joinedAt: participant.joinedAt?.getTime() ?? 0,
  };
}

/** Raised hands first (oldest first), then you, then by joining time. */
export function inOrder(people: CallPerson[]): CallPerson[] {
  return [...people].sort((a, b) => {
    if (a.handRaisedAt && b.handRaisedAt) return a.handRaisedAt.localeCompare(b.handRaisedAt);
    if (a.handRaisedAt || b.handRaisedAt) return a.handRaisedAt ? -1 : 1;
    if (a.isYou !== b.isYou) return a.isYou ? -1 : 1;
    return a.joinedAt - b.joinedAt;
  });
}
