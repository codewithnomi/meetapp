// The pre-join's left side (approved "Pre-join" canvas, AC-F02-09, 10): the own camera preview, the
// microphone and camera switches, the three device lists, the microphone level with Test speakers, and
// what is wrong with a device (the person can still join without it).
import { Button, DeviceSelect, IconButton, LevelMeter, Notice, VideoTile } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { BackgroundChoice, useBackgroundPreview } from "../../features/devices/index.ts";
import {
  LocalVideo,
  deviceOptions,
  problemKey,
  testSpeakers,
  type MediaKind,
  type PreJoinDevices,
} from "../../features/meetings/index.ts";

function Problems({ devices }: { devices: PreJoinDevices }) {
  const { t } = useTranslation();
  const kinds: MediaKind[] = ["camera", "microphone"];
  return kinds.map((kind) => {
    const problem = devices[kind].problem;
    return problem ? (
      <Notice key={kind} tone="danger" icon={kind === "camera" ? "camera-off" : "mic-off"}>
        {t(problemKey(kind, problem))}
      </Notice>
    ) : null;
  });
}

function Switches({ devices }: { devices: PreJoinDevices }) {
  const { t } = useTranslation();
  const { prefs, change } = devices;
  return (
    <div className="flex justify-center gap-3">
      <IconButton
        icon={prefs.microphoneOn ? "mic" : "mic-off"}
        off={!prefs.microphoneOn}
        labelIsAction
        label={prefs.microphoneOn ? t("meetings.devices.micOff") : t("meetings.devices.micOn")}
        onClick={() => change({ microphoneOn: !prefs.microphoneOn })}
      />
      <IconButton
        icon={prefs.cameraOn ? "camera" : "camera-off"}
        off={!prefs.cameraOn}
        labelIsAction
        label={prefs.cameraOn ? t("meetings.devices.cameraOff") : t("meetings.devices.cameraOn")}
        onClick={() => change({ cameraOn: !prefs.cameraOn })}
      />
    </div>
  );
}

function Choices({ devices }: { devices: PreJoinDevices }) {
  const { t } = useTranslation();
  const { prefs, change, lists } = devices;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
      <DeviceSelect
        label={t("meetings.devices.camera")}
        value={prefs.cameraId}
        options={deviceOptions(lists.cameras, t("meetings.devices.camera"))}
        emptyLabel={t("meetings.devices.noCamera")}
        onChange={(cameraId) => change({ cameraId })}
      />
      <DeviceSelect
        label={t("meetings.devices.microphone")}
        value={prefs.microphoneId}
        options={deviceOptions(lists.microphones, t("meetings.devices.microphone"))}
        emptyLabel={t("meetings.devices.noMicrophone")}
        onChange={(microphoneId) => change({ microphoneId })}
      />
      <DeviceSelect
        label={t("meetings.devices.speakers")}
        value={prefs.speakerId}
        options={deviceOptions(lists.speakers, t("meetings.devices.speakers"))}
        emptyLabel={t("meetings.devices.defaultSpeakers")}
        onChange={(speakerId) => change({ speakerId })}
      />
    </div>
  );
}

export function DevicesSection({ devices, name }: { devices: PreJoinDevices; name: string }) {
  const { t } = useTranslation();
  const { prefs, camera, level, change } = devices;
  const shown = useBackgroundPreview(camera.stream, prefs.background);
  return (
    <section
      aria-label={t("meetings.devices.label")}
      className="flex max-w-170 min-w-0 flex-[1_1_520px] flex-col gap-4"
    >
      <VideoTile
        name={name}
        cameraOff={!prefs.cameraOn || !shown}
        {...(shown ? { video: <LocalVideo stream={shown} /> } : {})}
        {...(prefs.microphoneOn ? {} : { mutedLabel: t("meetings.devices.muted") })}
      />
      <Switches devices={devices} />
      <Choices devices={devices} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-[550]">{t("meetings.devices.level")}</span>
          <LevelMeter level={level} label={t("meetings.devices.level")} />
        </div>
        <Button variant="ghost" size="sm" icon="sliders" onClick={() => void testSpeakers(prefs.speakerId)}>
          {t("meetings.devices.testSpeakers")}
        </Button>
      </div>
      <BackgroundChoice value={prefs.background} onChange={(background) => change({ background })} />
      <Problems devices={devices} />
      <p className="m-0 text-[13px] text-ink-muted">{t("meetings.devices.remembered")}</p>
    </section>
  );
}
