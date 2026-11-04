// The only bridge between the screens and the computer (design.md section 5): the platform name, so the
// screens can adapt (e.g. macOS window buttons); `auth`, the sign-in calls main makes for the screens
// (F01 design.md section 4), the token never comes back; and `media` and `deviceKey` (F02 design.md
// section 5): camera/mic/screen access, the share picker's sources and choice, and this app's device key.
// Built as CommonJS, as sandboxed preloads require.
import { contextBridge, ipcRenderer } from "electron";
import { LOGIN_ITEM_CHANNEL } from "../main/login-item.ts";
import { MEETING_LINK_CHANNEL, isMeetingCode } from "../main/links.ts";
import { APP_CHANNEL, isTrayCommand, type TrayCommand } from "../main/tray-menu.ts";
import { AUTH_ACTION_NAMES, AUTH_CHANNEL } from "../main/auth-actions.ts";
import { CALL_WINDOWS_CHANNEL, FRAMES_CHANNEL } from "../main/call-windows.ts";
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

// F16 (D079): report incoming calls and the current call so main can show the small windows above other
// apps; carry out the button presses main passes back. Returns "stop listening".
// The live-video line to the mini window (design.md 3.5): main hands over one end while it shows.
let framePort: MessagePort | undefined;
let framesWanted: ((wanted: boolean) => void) | undefined;
ipcRenderer.on(FRAMES_CHANNEL, (event) => {
  framePort?.close();
  framePort = event.ports[0];
  framesWanted?.(framePort !== undefined);
});

const callWindows = {
  report: (state: unknown) => {
    ipcRenderer.send(CALL_WINDOWS_CHANNEL, state);
  },
  onAction: (listener: (action: unknown) => void) => {
    const handler = (_event: unknown, action: unknown) => {
      listener(action);
    };
    ipcRenderer.on(CALL_WINDOWS_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(CALL_WINDOWS_CHANNEL, handler);
    };
  },
  /** Tells whether the mini window wants pictures now; returns "stop listening". */
  onFramesWanted: (listener: (wanted: boolean) => void) => {
    framesWanted = listener;
    listener(framePort !== undefined);
    return () => {
      framesWanted = undefined;
    };
  },
  /** One JPEG picture of the speaker for the mini window; dropped when it isn't showing. */
  sendFrame: (frame: ArrayBuffer) => {
    if (frame instanceof ArrayBuffer && frame.byteLength <= 200_000) framePort?.postMessage(frame, [frame]);
  },
};

// F04: what the menu-bar or tray menu asks the screens to do (open Settings, set a status); only checked
// commands get through. Returns "stop listening".
const appCommands = {
  // F04 AC-10: a clicked meeting link, as a checked meeting code; tells main the screens now listen.
  onOpenMeeting: (listener: (code: string) => void) => {
    const handler = (_event: unknown, code: unknown) => {
      if (isMeetingCode(code)) listener(code);
    };
    ipcRenderer.on(MEETING_LINK_CHANNEL, handler);
    ipcRenderer.send(MEETING_LINK_CHANNEL, "listening");
    return () => {
      ipcRenderer.removeListener(MEETING_LINK_CHANNEL, handler);
    };
  },
  // F04 AC-09: Settings → General "Start MeetApp when I log in"; answers the real state.
  loginItem: {
    get: () => ipcRenderer.invoke(LOGIN_ITEM_CHANNEL, "get"),
    set: (on: boolean) => ipcRenderer.invoke(LOGIN_ITEM_CHANNEL, "set", on),
  },
  onTrayCommand: (listener: (command: TrayCommand) => void) => {
    const handler = (_event: unknown, command: unknown) => {
      if (isTrayCommand(command)) listener(command);
    };
    ipcRenderer.on(APP_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(APP_CHANNEL, handler);
    };
  },
};

contextBridge.exposeInMainWorld("meetapp", {
  platform: process.platform,
  auth,
  media,
  deviceKey,
  files,
  power,
  callWindows,
  app: appCommands,
});
