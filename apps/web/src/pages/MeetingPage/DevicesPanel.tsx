// Device settings during the meeting (approved "Device settings in a meeting" canvas, AC-F02-28, 30,
// 31): camera, microphone with its level, speakers with Test speakers, noise suppression (on by default)
// and, when the own line is weak, the note about it. Choices apply at once and are remembered.
import { DevicePanel } from "@meetapp/ui";
import type { Room } from "livekit-client";
import { useTranslation } from "react-i18next";
import { BackgroundChoice } from "../../features/devices/index.ts";
import {
  deviceActions,
  deviceOptions,
  testSpeakers,
  useDeviceLists,
  useMicLevel,
  useSentMicrophone,
  type DevicePrefs,
  type DeviceKind,
} from "../../features/meetings/index.ts";

export interface DevicesPanelProps {
  room: Room | undefined;
  prefs: DevicePrefs;
  setPrefs: (prefs: DevicePrefs) => void;
  weak: boolean;
  onClose: () => void;
}

export function DevicesPanel({ room, prefs, setPrefs, weak, onClose }: DevicesPanelProps) {
  const { t } = useTranslation();
  const lists = useDeviceLists(room);
  const level = useMicLevel(useSentMicrophone(room));
  const act = deviceActions(room, prefs, setPrefs);
  const active = (kind: DeviceKind, saved: string) => room?.getActiveDevice(kind) ?? saved;
  return (
    <DevicePanel
      title={t("meetings.call.devices")}
      closeLabel={t("meetings.call.closeDevices")}
      onClose={onClose}
      camera={{
        label: t("meetings.devices.camera"),
        value: active("videoinput", prefs.cameraId),
        options: deviceOptions(lists.cameras, t("meetings.devices.camera")),
        emptyLabel: t("meetings.devices.noCamera"),
        onChange: (id) => act.choose("videoinput", id),
      }}
      microphone={{
        label: t("meetings.devices.microphone"),
        value: active("audioinput", prefs.microphoneId),
        options: deviceOptions(lists.microphones, t("meetings.devices.microphone")),
        emptyLabel: t("meetings.devices.noMicrophone"),
        onChange: (id) => act.choose("audioinput", id),
        level,
        levelLabel: t("meetings.devices.level"),
      }}
      speakers={{
        label: t("meetings.devices.speakers"),
        value: active("audiooutput", prefs.speakerId),
        options: deviceOptions(lists.speakers, t("meetings.devices.speakers")),
        emptyLabel: t("meetings.devices.defaultSpeakers"),
        onChange: (id) => act.choose("audiooutput", id),
        test: {
          label: t("meetings.devices.testSpeakers"),
          onClick: () => void testSpeakers(active("audiooutput", prefs.speakerId)),
        },
      }}
      noiseSuppression={{
        label: t("meetings.call.noiseSuppression"),
        description: t("meetings.call.noiseSuppressionHint"),
        checked: prefs.noiseSuppression,
        onChange: act.noiseSuppression,
      }}
      background={<BackgroundChoice value={prefs.background} onChange={act.background} />}
      note={weak ? { title: t("meetings.call.weakTitle"), text: t("meetings.call.weakBody") } : undefined}
    />
  );
}
