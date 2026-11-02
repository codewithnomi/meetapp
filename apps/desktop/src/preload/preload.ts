// The only bridge between the screens and the computer (design.md section 5): the platform name, so the
// screens can adapt (e.g. macOS window buttons); `auth`, the sign-in calls main makes for the screens
// (F01 design.md section 4), the token never comes back; and `media` and `deviceKey` (F02 design.md
// section 5): camera/mic/screen access, the share picker's sources and choice, and this app's device key.
// Built as CommonJS, as sandboxed preloads require.
import { contextBridge, ipcRenderer } from "electron";
import { AUTH_ACTION_NAMES, AUTH_CHANNEL } from "../main/auth-actions.ts";
import { FILES_CHANNEL, POWER_CHANNEL } from "../main/chat-desktop.ts";
import { MEDIA_ACTION_NAMES, MEDIA_CHANNEL } from "../main/media-actions.ts";

const auth = Object.fromEntries(
  AUTH_ACTION_NAMES.map((name) => [name, (...args: unknown[]) => ipcRenderer.invoke(AUTH_CHANNEL, name, args)]),
);

const media = Object.fromEntries(
  MEDIA_ACTION_NAMES.filter((name) => name !== "deviceKey").map((name) => [
    name,
    (...args: unknown[]) => ipcRenderer.invoke(MEDIA_CHANNEL, name, args),
  ]),
);
const deviceKey = () => ipcRenderer.invoke(MEDIA_CHANNEL, "deviceKey", []);
// F03: save a chat file from our backend with a "Save as" dialog.
const files = { save: (url: string) => ipcRenderer.invoke(FILES_CHANNEL, "save", url) };

// F14: whether the computer is locked (Away). Only a yes/no reaches the screens; returns "stop listening".
const power = {
  onLockChange: (listener: (locked: boolean) => void) => {
    const handler = (_event: unknown, locked: unknown) => {
      listener(locked === true);
    };
    ipcRenderer.on(POWER_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(POWER_CHANNEL, handler);
    };
  },
};

contextBridge.exposeInMainWorld("meetapp", { platform: process.platform, auth, media, deviceKey, files, power });
