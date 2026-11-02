// Finding chats by name in the chat list (F14 AC-F14-04): every typed word must appear in the chat's
// name or one of its people's names, in any order, ignoring upper/lower case and accents. Names only,
// never message text.

/** "José Álvarez" → "jose alvarez". */
const plainWords = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** True when every word of `query` is contained in one of `names`. */
export function matchesNames(query: string, names: string[]): boolean {
  const words = plainWords(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = names.map(plainWords);
  return words.every((word) => haystack.some((name) => name.includes(word)));
}
