// Fixture: a molecule fetching its own data breaks frontend.md rule 2 (must fail only-pages-use-features).
import { useMeetings } from "../../features/meetings/useMeetings.ts";

export function MeetingList() {
  return <ul>{useMeetings().length}</ul>;
}
