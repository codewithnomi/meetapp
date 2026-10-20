// What a person typed into "Join a meeting", made ready to send (AC-F02-08). The meeting ID may be
// typed with spaces ("284 615 903 172"); a pasted link is only trimmed. Nothing else is checked here:
// the backend gives every miss the same answer.

export function linkAddress(link: string): { link: string } {
  return { link: link.trim() };
}

export function idAddress(meetingNumber: string, passcode: string): { meetingNumber: string; passcode: string } {
  return { meetingNumber: meetingNumber.replace(/[\s-]/g, ""), passcode: passcode.trim() };
}

/** "284615903172" → "284 615 903 172", as Meeting info shows it. */
export function spacedMeetingNumber(meetingNumber: string): string {
  return meetingNumber.replace(/(\d{3})(?=\d)/g, "$1 ");
}
