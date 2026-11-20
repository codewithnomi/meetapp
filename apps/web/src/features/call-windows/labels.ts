// The words F16's mini call window and F17's small call view share (AC-F16-15, 21; AC-F17-02): what the
// caption says in each phase, and the mute and camera buttons' names, which say why one is off.
import type { CallWindowsCall } from "@meetapp/contracts";
import type { TFunction } from "i18next";
import { shortcutText } from "../meetings/index.ts";

export function callCaption(call: CallWindowsCall, t: TFunction): string {
  if (call.phase === "reconnecting") return t("calls.windows.reconnecting");
  if (call.phase === "lobby") return t("calls.windows.lobby");
  if (call.phase === "calling") return t("calls.windows.calling", { name: call.title });
  return t(call.speaker.sharing ? "calls.windows.sharing" : "calls.windows.speaking", { name: call.speaker.name });
}

/** Mute and camera as the call shows them; a microphone the organizer turned off says so (AC-F16-16). */
export function micAndCamera(call: CallWindowsCall, t: TFunction, press: { mic: () => void; camera: () => void }) {
  return {
    mic: {
      label:
        call.canUnmute || call.mic
          ? t(call.mic ? "calls.windows.mute" : "calls.windows.unmute", { keys: shortcutText("M") })
          : t("calls.windows.micLocked"),
      on: call.mic,
      disabled: !call.mic && !call.canUnmute,
      onClick: press.mic,
    },
    camera: {
      label: t(call.camera ? "calls.windows.cameraOff" : "calls.windows.cameraOn", { keys: shortcutText("O") }),
      on: call.camera,
      onClick: press.camera,
    },
  };
}
