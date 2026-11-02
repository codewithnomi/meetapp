// The meeting's control bar (approved "Meeting: gallery" canvas, AC-F02-22, 23, 24, 38, 44): microphone
// and camera (also with ⌘⇧M and ⌘⇧O), the hand (⌘⇧K), reactions, Leave, and End meeting for the
// organizer and co-organizers, sharing for presenters and up (AC-F02-25), and More for device settings.
import { ControlBar } from "@meetapp/ui";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { REACTIONS, EMOJI, can, shortcutText, type CallPerson, type Reaction } from "../../features/meetings/index.ts";

export type Panel = "people" | "chat" | "info" | "devices" | undefined;

export interface CallControlsProps {
  me: CallPerson | undefined;
  may: { microphone: boolean; camera: boolean; screen: boolean };
  elapsed: string;
  count: number;
  /** Unread chat messages while the chat is closed (AC-F03-07). */
  unread: number;
  panel: Panel;
  onPanel: (panel: Panel) => void;
  onMicrophone: () => void;
  onCamera: () => void;
  onHand: () => void;
  onReaction: (reaction: Reaction) => void;
  onShare: () => void;
  onLeave: () => void;
  onEnd: () => void;
  /** A call from a chat (F15): the people button is Add people, and there is no Meeting info. */
  chatCall?: boolean;
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

/** Share: on while sharing (pressing stops it); presenters and up may start one (AC-F02-25). */
function shareSwitch(t: TFunction, me: CallPerson | undefined, may: CallControlsProps["may"], onShare: () => void) {
  const allowed = may.screen && can(me?.role, "share");
  const sharing = Boolean(me?.screen);
  const label = sharing ? "meetings.call.stopShare" : allowed ? "meetings.call.share" : "meetings.call.shareNotAllowed";
  return { on: sharing, label: t(label), onToggle: onShare, disabled: !sharing && !allowed };
}

function reactionMenu(t: TFunction, onReaction: (reaction: Reaction) => void) {
  return {
    label: t("meetings.call.react"),
    actions: REACTIONS.map((reaction) => ({
      id: reaction,
      label: `${EMOJI[reaction]} ${t(`meetings.call.reactions.${reaction}`)}`,
      onSelect: () => onReaction(reaction),
    })),
  };
}

export function CallControls(props: CallControlsProps) {
  const { t } = useTranslation();
  const { me, may, elapsed, count, panel, onPanel } = props;
  const labels = useLabels(me, may);
  const canEnd = can(me?.role, "end");
  const toggle = (which: Exclude<Panel, undefined>) => onPanel(panel === which ? undefined : which);
  return (
    <ControlBar
      label={t("meetings.call.controls")}
      elapsed={elapsed}
      mic={{ on: me?.micOn ?? false, label: labels.mic, onToggle: props.onMicrophone, disabled: !may.microphone }}
      camera={{ on: me?.cameraOn ?? false, label: labels.camera, onToggle: props.onCamera, disabled: !may.camera }}
      share={shareSwitch(t, me, may, props.onShare)}
      hand={{ on: Boolean(me?.handRaisedAt), label: labels.hand, onToggle: props.onHand }}
      reactions={reactionMenu(t, props.onReaction)}
      more={{ label: t("meetings.call.moreOptions"), active: panel === "devices", onClick: () => toggle("devices") }}
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
        label: props.chatCall ? t("calls.add.button") : t("meetings.call.people", { count }),
        count,
        active: panel === "people",
        onClick: () => toggle("people"),
      }}
      chat={{
        label: props.unread > 0 ? t("meetings.chat.buttonUnread", { count: props.unread }) : t("meetings.chat.button"),
        unread: props.unread,
        active: panel === "chat",
        onClick: () => toggle("chat"),
      }}
      info={
        props.chatCall
          ? undefined
          : { label: t("meetings.call.info"), active: panel === "info", onClick: () => toggle("info") }
      }
    />
  );
}
