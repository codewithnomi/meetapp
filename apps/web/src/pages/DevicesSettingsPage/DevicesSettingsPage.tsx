// Settings → Devices (F15 AC-F15-29, approved canvas "Settings: devices and calls"): a live camera
// preview, camera, microphone with its level, speaker with Test speakers, and noise suppression. The
// choices are remembered on this computer and every call and meeting starts from them; a chosen device
// that was unplugged is reported and the default is used.
import { DeviceSelect, Button, LevelMeter, Notice, Toggle, VideoTile } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import {
  BackgroundChoice,
  LocalVideo,
  useBackgroundPreview,
  useBackgroundSlow,
  deviceOptions,
  problemKey,
  testSpeakers,
  useDeviceSettings,
} from "../../features/devices/index.ts";
import { SettingsShell, type SettingsScreen } from "../../features/profile/index.ts";

export interface DevicesSettingsPageProps {
  onNavigate: (screen: SettingsScreen) => void;
  onBack: () => void;
}

type Devices = ReturnType<typeof useDeviceSettings>;

/** "Background turned off to keep your video smooth" (AC-F15-31). */
function SlowNotice() {
  const { t } = useTranslation();
  const turnedOff = useBackgroundSlow((state) => state.turnedOff);
  return turnedOff ? <Notice tone="neutral">{t("devices.backgrounds.turnedOff")}</Notice> : null;
}

function Preview({ devices }: { devices: Devices }) {
  const { t } = useTranslation();
  const { camera, prefs } = devices;
  // The preview shows the chosen background, made on this computer (AC-F15-30).
  const shown = useBackgroundPreview(camera.stream, prefs.background);
  return (
    <figure className="m-0 flex flex-col gap-2">
      <VideoTile
        name={t("settings.devices.you")}
        cameraOff={!shown}
        {...(shown ? { video: <LocalVideo stream={shown} /> } : {})}
      />
      <figcaption className="text-[13px] text-ink-muted">{t("settings.devices.previewNote")}</figcaption>
      {camera.problem ? (
        <Notice tone="danger" icon="camera-off">
          {t(problemKey("camera", camera.problem))}
        </Notice>
      ) : null}
    </figure>
  );
}

function Speaker({ devices }: { devices: Devices }) {
  const { t } = useTranslation();
  const { prefs, change, lists } = devices;
  return (
    <div className="flex flex-col gap-2">
      <DeviceSelect
        label={t("meetings.devices.speakers")}
        value={prefs.speakerId}
        options={deviceOptions(lists.speakers, t("meetings.devices.speakers"))}
        emptyLabel={t("meetings.devices.defaultSpeakers")}
        onChange={(speakerId) => change({ speakerId })}
      />
      <Button
        variant="ghost"
        size="sm"
        icon="sliders"
        className="self-start"
        onClick={() => void testSpeakers(prefs.speakerId)}
      >
        {t("meetings.devices.testSpeakers")}
      </Button>
    </div>
  );
}

function Choices({ devices }: { devices: Devices }) {
  const { t } = useTranslation();
  const { prefs, change, lists, level, microphone } = devices;
  return (
    <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
      <DeviceSelect
        label={t("meetings.devices.camera")}
        value={prefs.cameraId}
        options={deviceOptions(lists.cameras, t("meetings.devices.camera"))}
        emptyLabel={t("meetings.devices.noCamera")}
        onChange={(cameraId) => change({ cameraId })}
      />
      <div className="flex flex-col gap-2">
        <DeviceSelect
          label={t("meetings.devices.microphone")}
          value={prefs.microphoneId}
          options={deviceOptions(lists.microphones, t("meetings.devices.microphone"))}
          emptyLabel={t("meetings.devices.noMicrophone")}
          onChange={(microphoneId) => change({ microphoneId })}
        />
        <div className="flex items-center gap-3 pl-3.5">
          <span className="text-[13px] text-ink-muted">{t("meetings.devices.level")}</span>
          <LevelMeter level={level} label={t("meetings.devices.level")} />
        </div>
        {microphone.problem ? (
          <Notice tone="danger" icon="mic-off">
            {t(problemKey("microphone", microphone.problem))}
          </Notice>
        ) : null}
      </div>
      <Speaker devices={devices} />
      <div className="border-t border-line pt-3.5">
        <Toggle
          id="settings-noise"
          label={t("meetings.call.noiseSuppression")}
          description={t("meetings.call.noiseSuppressionHint")}
          checked={prefs.noiseSuppression}
          onChange={(noiseSuppression) => change({ noiseSuppression })}
        />
      </div>
    </div>
  );
}

export function DevicesSettingsPage({ onNavigate, onBack }: DevicesSettingsPageProps) {
  const { t } = useTranslation();
  const devices = useDeviceSettings();
  return (
    <SettingsShell screen="devices" onNavigate={onNavigate} onBack={onBack}>
      <section aria-labelledby="devices-heading" className="flex flex-col gap-5">
        <header>
          <h2 id="devices-heading" className="m-0 text-heading text-ink">
            {t("settings.devices.title")}
          </h2>
          <p className="mt-1 mb-0 text-ink-muted">{t("settings.devices.intro")}</p>
        </header>
        {devices.missing.map((kind) => (
          <Notice key={kind} tone="neutral">
            {t(`settings.devices.missing.${kind}`)}
          </Notice>
        ))}
        <div className="flex flex-wrap gap-6">
          <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3">
            <Preview devices={devices} />
            <BackgroundChoice
              value={devices.prefs.background}
              onChange={(background) => devices.change({ background })}
            />
            <SlowNotice />
          </div>
          <Choices devices={devices} />
        </div>
      </section>
    </SettingsShell>
  );
}
