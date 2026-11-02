// The small call windows' only bridge (F16 design.md section 1; D079): the state to show, button presses
// back, and the live-video pictures for the mini window. Nothing else: no auth, media, files or device key.
// Built as CommonJS, as sandboxed preloads require.
import { contextBridge, ipcRenderer } from "electron";
import { CALL_WINDOW_CHANNEL } from "../main/call-windows.ts";

type Listener = (value: unknown) => void;
const FRAME_PORT = `${CALL_WINDOW_CHANNEL}:frames`;

let frameListener: ((frame: ArrayBuffer) => void) | undefined;
ipcRenderer.on(FRAME_PORT, (event) => {
  const [port] = event.ports;
  if (!port) return;
  port.onmessage = (message: MessageEvent) => {
    if (message.data instanceof ArrayBuffer) frameListener?.(message.data);
  };
});

contextBridge.exposeInMainWorld("meetappCallWindow", {
  onState: (listener: Listener) => {
    const handler = (_event: unknown, state: unknown) => {
      listener(state);
    };
    ipcRenderer.on(CALL_WINDOW_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(CALL_WINDOW_CHANNEL, handler);
    };
  },
  act: (action: unknown) => {
    ipcRenderer.send(CALL_WINDOW_CHANNEL, action);
  },
  onFrame: (listener: (frame: ArrayBuffer) => void) => {
    frameListener = listener;
    return () => {
      frameListener = undefined;
    };
  },
});
