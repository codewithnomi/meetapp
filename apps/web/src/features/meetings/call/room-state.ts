// What the backend keeps in the room's shared metadata (design 3.6): the meeting options, whether the
// meeting is locked (and the chat setting, F03 AC-F03-35), and when the 30-hour limit ends it.
export interface RoomState {
  locked: boolean;
  options:
    | { allowAttendeeMic: boolean; allowAttendeeCamera: boolean; chatMode?: "on" | "in_meeting" | "off" | undefined }
    | undefined;
  endsAt: string | undefined;
}

export function roomStateOf(metadata: string | undefined): RoomState {
  try {
    const value = JSON.parse(metadata ?? "{}") as Partial<RoomState>;
    return { locked: value.locked === true, options: value.options, endsAt: value.endsAt };
  } catch {
    return { locked: false, options: undefined, endsAt: undefined };
  }
}
