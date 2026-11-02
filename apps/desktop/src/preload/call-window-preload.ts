// The small call windows' only bridge (F16 design.md section 1; D079): the state to show, button presses
// back, and the live-video pictures for the mini window. Nothing else: no auth, media, files or device key.
// Built as CommonJS, as sandboxed preloads require.
import { contextBridge, ipcRenderer } from "electron";
import { CALL_WINDOW_CHANNEL, FRAMES_CHANNEL } from "../main/call-windows.ts";

type Listener = (value: unknown) => void;

let frameListener: ((frame: ArrayBuffer) => void) | undefined;
ipcRenderer.on(FRAMES_CHANNEL, (event) => {
  const [port] = event.ports;
  if (!port) return;
  port.onmessage = (message: MessageEvent) => {
    // At most 200 KB a picture, as the sender promises (security review).
    if (message.data instanceof ArrayBuffer && message.data.byteLength <= 200_000) frameListener?.(message.data);
  };
});

// The first state can arrive before the page listens: it is kept and handed over when the page does.
let lastState: unknown;
let stateListener: Listener | undefined;
ipcRenderer.on(CALL_WINDOW_CHANNEL, (_event, state: unknown) => {
  lastState = state;
  stateListener?.(state);
});

contextBridge.exposeInMainWorld("meetappCallWindow", {
  onState: (listener: Listener) => {
    stateListener = listener;
    if (lastState !== undefined) listener(lastState);
    return () => {
      stateListener = undefined;
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
