// The only bridge between the screens and the computer: today just the platform name, so the screens
// can adapt (e.g. macOS window buttons). Built as CommonJS, as sandboxed preloads require.
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("meetapp", { platform: process.platform });
