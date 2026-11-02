// The cached answers about calls, named once so every screen refreshes the same entries.
export const CALL_KEYS = {
  /** The person's ringtone and volume (Settings → Calls and the incoming call). */
  ringSettings: ["ring-settings"],
  /** The person's calls on other devices (the "another device" bar). */
  active: ["active-calls"],
  /** A chat's running call; under "chats" so chat news refreshes it (call buttons, Add people). */
  running: (conversationId: string) => ["chats", "call", conversationId],
} as const;
