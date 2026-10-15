// The meeting's control bar (approved "Meeting: gallery" canvas, AC-F02-22, 23, 24, 38, 44): microphone
// and camera (also with ⌘⇧M and ⌘⇧O), the hand (⌘⇧K), reactions, Leave, and End meeting for the
// organizer and co-organizers. Sharing and More (device settings) arrive with T15 and T16.
import { ControlBar } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { REACTIONS, EMOJI, shortcutText, type CallPerson, type Reaction } from "../../features/meetings/index.ts";

export type Panel = "people" | "info" | undefined;

export interface CallControlsProps {
  me: CallPerson | undefined;
  may: { microphone: boolean; camera: boolean };
  elapsed: string;
  count: number;
  panel: Panel;
  onPanel: (panel: Panel) => void;
  onMicrophone: () => void;
  onCamera: () => void;
  onHand: () => void;
  onReaction: (reaction: Reaction) => void;
  onLeave: () => void;
  onEnd: () => void;
}

function useLabels(me: CallPerson | undefined, may: CallControlsProps["may"]) {
  const { t } = useTranslation();
  const mic = me?.micOn ?? false;
  const camera = me?.cameraOn ?? false;
  return {
    mic: may.microphone
      ? t(mic ? "meetings.call.mute" : "meetings.call.unmute", { keys: shortcutText("M") })
      : t("meetings.call.micNotAllowed"),
    camera: may.camera
      ? t(camera ? "meetings.call.cameraOff" : "meetings.call.cameraOn", { keys: shortcutText("O") })
      : t("meetings.call.cameraNotAllowed"),
    hand: t(me?.handRaisedAt ? "meetings.call.lowerHand" : "meetings.call.raiseHand", { keys: shortcutText("K") }),
  };
}

export function CallControls(props: CallControlsProps) {
  const { t } = useTranslation();
  const { me, may, elapsed, count, panel, onPanel } = props;
  const labels = useLabels(me, may);
  const canEnd = me?.role === "organizer" || me?.role === "co_organizer";
  const toggle = (which: Exclude<Panel, undefined>) => onPanel(panel === which ? undefined : which);
  return (
    <ControlBar
      label={t("meetings.call.controls")}
      elapsed={elapsed}
      mic={{ on: me?.micOn ?? false, label: labels.mic, onToggle: props.onMicrophone, disabled: !may.microphone }}
      camera={{ on: me?.cameraOn ?? false, label: labels.camera, onToggle: props.onCamera, disabled: !may.camera }}
      share={{ on: false, label: t("meetings.call.share"), onToggle: () => undefined, disabled: true }}
      hand={{ on: Boolean(me?.handRaisedAt), label: labels.hand, onToggle: props.onHand }}
      reactions={{
        label: t("meetings.call.react"),
        actions: REACTIONS.map((reaction) => ({
          id: reaction,
          label: `${EMOJI[reaction]} ${t(`meetings.call.reactions.${reaction}`)}`,
          onSelect: () => props.onReaction(reaction),
        })),
      }}
      more={{ label: t("meetings.call.moreOptions"), active: false, onClick: () => undefined, disabled: true }}
      leave={{
        label: t("meetings.call.leave"),
        onLeave: props.onLeave,
        menu: canEnd
          ? {
              label: t("meetings.call.moreLeave"),
              actions: [{ id: "end", label: t("meetings.call.end"), danger: true, onSelect: props.onEnd }],
            }
          : undefined,
      }}
      people={{
        label: t("meetings.call.people", { count }),
        count,
        active: panel === "people",
        onClick: () => toggle("people"),
      }}
      info={{ label: t("meetings.call.info"), active: panel === "info", onClick: () => toggle("info") }}
    />
  );
}
