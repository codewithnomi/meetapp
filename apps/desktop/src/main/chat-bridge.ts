// Electron wiring for meeting chat (F03 design.md 5.1 and 6). Thin on purpose; the rules live in
// chat-desktop.ts. Spell checking runs on the computer only; chat files are saved with "Save as".
import { Menu, ipcMain, type Session, type WebContents } from "electron";
import { fromAppPage } from "./auth-bridge.ts";
import { FILES_CHANNEL, SPELLCHECK_LANGUAGES, dictionaryUrl, isChatFileUrl, spellcheckMenu } from "./chat-desktop.ts";
import { APP_ORIGIN } from "./security.ts";

/** The computer's own spell checker (macOS); on Windows the dictionaries come from the app, never online. */
export function setUpSpellcheck(session: Session): void {
  session.setSpellCheckerDictionaryDownloadURL(dictionaryUrl(APP_ORIGIN));
  if (process.platform !== "darwin") session.setSpellCheckerLanguages(SPELLCHECK_LANGUAGES);
}

/** The right-click menu with spelling suggestions (AC-F03-18). */
export function addSpellcheckMenu(contents: WebContents): void {
  contents.on("context-menu", (_event, params) => {
    const entries = spellcheckMenu(params);
    if (entries.length === 0) return;
    const menu = Menu.buildFromTemplate(
      entries.map((entry) => {
        if (entry.kind === "separator") return { type: "separator" as const };
        if (entry.kind === "edit") return { label: entry.label, role: entry.role };
        if (entry.kind === "addWord") {
          return { label: entry.label, click: () => contents.session.addWordToSpellCheckerDictionary(entry.word) };
        }
        return { label: entry.label, click: () => contents.replaceMisspelling(entry.label) };
      }),
    );
    menu.popup();
  });
}

/** `meetapp.files.save(url)`: the app's own page asks to save a chat file; only our backend's links. */
export function registerFilesBridge(appUrl: string, apiUrl: string): void {
  ipcMain.handle(FILES_CHANNEL, (event, name: unknown, url: unknown) => {
    if (!fromAppPage(event, appUrl)) throw new Error("Refused: not the app's own page");
    if (name !== "save" || typeof url !== "string" || !isChatFileUrl(url, apiUrl)) return false;
    event.sender.downloadURL(url);
    return true;
  });
}
