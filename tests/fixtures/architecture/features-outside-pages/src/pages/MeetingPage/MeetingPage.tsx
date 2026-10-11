// Fixture: a page using features/ is allowed.
import { useMeetings } from "../../features/meetings/useMeetings.ts";

export function MeetingPage() {
  return <main>{useMeetings().length}</main>;
}
