// "… is typing" timing (F14 AC-F14-23, design 3.4): while a person types, the app sends at most one
// signal every 3 seconds; a receiver shows the name until 5 seconds after the last signal. Typing is
// never stored.
const TYPING_SEND_EVERY_MS = 3000;
const TYPING_SHOW_FOR_MS = 5000;

/** Whether a key press should send a typing signal now. */
export function createTypingSender(now: () => number) {
  let last = Number.NEGATIVE_INFINITY;
  return {
    shouldSend: () => {
      const at = now();
      if (at - last < TYPING_SEND_EVERY_MS) return false;
      last = at;
      return true;
    },
    /** After sending a message, the next key press signals at once. */
    reset: () => {
      last = Number.NEGATIVE_INFINITY;
    },
  };
}

/** Who is typing in one chat, as the receiver shows it. */
export function createTypingList(now: () => number) {
  const seen = new Map<string, { name: string; at: number }>();
  return {
    signal: (userId: string, name: string) => {
      seen.set(userId, { name, at: now() });
    },
    /** A message from them ends their typing at once. */
    stopped: (userId: string) => {
      seen.delete(userId);
    },
    names: () => {
      const at = now();
      for (const [id, entry] of seen) if (at - entry.at >= TYPING_SHOW_FOR_MS) seen.delete(id);
      return [...seen.values()].map((entry) => entry.name);
    },
  };
}
