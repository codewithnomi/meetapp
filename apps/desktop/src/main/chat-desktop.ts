// Meeting chat on the computer (F03 design.md sections 5.1, 6 and S17). The rules, without Electron, so
// they can be tested: only chat file links from our backend may be saved (with a "Save as" dialog),
// and the spell-check menu offers corrections, "Add to dictionary" and the usual editing commands.

export const FILES_CHANNEL = "meetapp:files";
/** F14: the computer locked or unlocked (main → screens only). */
export const POWER_CHANNEL = "meetapp:power";
export const SPELLCHECK_LANGUAGES = ["en-US"];

/** A chat file link from our own backend (`/api/v1/chat-files/<token>`); nothing else is ever saved. */
export function isChatFileUrl(url: string, apiUrl: string): boolean {
  try {
    const parsed = new URL(url);
    const api = new URL(apiUrl);
    return parsed.origin === api.origin && /^\/api\/v1\/chat-files\/[\w.-]{20,300}$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

/** Where Windows looks for spell-check dictionaries: the app's own files, never an outside server (TC-F03-34). */
export function dictionaryUrl(appOrigin: string): string {
  return `${appOrigin}/dictionaries/`;
}

export interface SpellcheckParams {
  misspelledWord: string;
  dictionarySuggestions: string[];
  isEditable: boolean;
  editFlags: { canCut: boolean; canCopy: boolean; canPaste: boolean };
}

export type MenuEntry =
  | { kind: "suggestion"; label: string }
  | { kind: "addWord"; label: string; word: string }
  | { kind: "edit"; label: string; role: "cut" | "copy" | "paste" }
  | { kind: "separator" };

/** The right-click menu in a text box (AC-F03-18); empty when there is nothing to offer. */
export function spellcheckMenu(params: SpellcheckParams): MenuEntry[] {
  const entries: MenuEntry[] = params.dictionarySuggestions.slice(0, 5).map((label) => ({ kind: "suggestion", label }));
  if (params.misspelledWord) {
    entries.push({ kind: "addWord", label: "Add to dictionary", word: params.misspelledWord });
  }
  if (!params.isEditable) return entries;
  if (entries.length > 0) entries.push({ kind: "separator" });
  const { canCut, canCopy, canPaste } = params.editFlags;
  if (canCut) entries.push({ kind: "edit", label: "Cut", role: "cut" });
  if (canCopy) entries.push({ kind: "edit", label: "Copy", role: "copy" });
  if (canPaste) entries.push({ kind: "edit", label: "Paste", role: "paste" });
  return entries;
}
