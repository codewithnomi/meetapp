// The emoji people may react with (AC-F03-12, 13): the same list the app's emoji picker uses
// (emojibase-data, D058), with every skin tone. Anything else sent as a reaction is refused.
import { createRequire } from "node:module";

interface EmojiEntry {
  unicode: string;
  skins?: { unicode: string }[];
}

const VARIATION_SELECTOR = /️/g;
/** One form per emoji: NFC, without the invisible "show as emoji" mark that some keyboards add. */
const keyOf = (value: string) => value.normalize("NFC").replace(VARIATION_SELECTOR, "");

const entries = createRequire(import.meta.url)("emojibase-data/en/compact.json") as EmojiEntry[];
const EMOJI = new Map<string, string>();
for (const entry of entries) {
  for (const form of [entry.unicode, ...(entry.skins ?? []).map((skin) => skin.unicode)]) {
    EMOJI.set(keyOf(form), form);
  }
}

/** The emoji as the list writes it, or undefined when the text is not one known emoji. */
export function knownEmoji(value: string): string | undefined {
  if (value.length > 40) return undefined;
  return EMOJI.get(keyOf(value));
}
