// What the backend keeps in the room's shared metadata (design 3.6): the meeting options, whether the
// meeting is locked, and when the 30-hour limit ends it.
export interface RoomState {
  locked: boolean;
  options: { allowAttendeeMic: boolean; allowAttendeeCamera: boolean } | undefined;
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
