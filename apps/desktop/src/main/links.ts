// Meeting links' shared pieces (F04 design.md 3.2), free of Electron so the preload can use them too.
// The small links entry only, so the preload stays small.
export { isMeetingCode, readAppMeetingLink } from "@meetapp/contracts/app-links";

/** Main → screens: a meeting code to look up; screens → main: "listening". */
export const MEETING_LINK_CHANNEL = "meetapp:meeting-link";

/** The link among a start's arguments (Windows passes it there), if any. */
export const linkInArgs = (args: readonly string[]): string | undefined => args.find((arg) => /^meetapp:/i.test(arg));
