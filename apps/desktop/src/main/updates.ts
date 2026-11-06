// Updates (F04 design.md 3.5; AC-F04-50; D084): electron-updater with GitHub releases, switched off by a
// build setting until the owner decides to go online. While off, the updater isn't even loaded, so it can
// never ask GitHub anything. Free of Electron, so it can be tested.

/** The screens ask for Settings → About: the version and whether updates are on. */
export const ABOUT_CHANNEL = "meetapp:about";

/** The build setting: false until MeetApp goes online (AC-F04-50). */
export const UPDATES_ENABLED = false;

export interface Updater {
  checkForUpdatesAndNotify: () => Promise<unknown>;
}

export interface UpdatesState {
  enabled: boolean;
}

/** Starts the updater only when switched on; `load` brings electron-updater in. */
export async function startUpdates(enabled: boolean, load: () => Promise<Updater>): Promise<UpdatesState> {
  if (!enabled) return { enabled: false };
  const updater = await load();
  await updater.checkForUpdatesAndNotify().catch(() => undefined);
  return { enabled: true };
}
