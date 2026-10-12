// The only bridge between the screens and the computer (design.md section 5): the platform name, so the
// screens can adapt (e.g. macOS window buttons), and `auth`, the sign-in calls main makes for the
// screens (F01 design.md section 4); the token never comes back. Built as CommonJS, as sandboxed
// preloads require.
import { contextBridge, ipcRenderer } from "electron";
import { AUTH_ACTION_NAMES, AUTH_CHANNEL } from "../main/auth-actions.ts";

const auth = Object.fromEntries(
  AUTH_ACTION_NAMES.map((name) => [name, (...args: unknown[]) => ipcRenderer.invoke(AUTH_CHANNEL, name, args)]),
);

contextBridge.exposeInMainWorld("meetapp", { platform: process.platform, auth });
