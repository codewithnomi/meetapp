// LobbyPage (page): waiting to be let in (approved "Lobby" canvas, AC-F02-14, 15, 18): the meeting's
// title, "Someone in the meeting will let you in soon", the own camera with the microphone and camera
// switches, and Leave. Nothing about who is inside is shown. The app asks for its status every 2
// seconds; when let in it goes to the meeting, and any other outcome shows its message.
import { Button, IconButton, Spinner, VideoTile } from "@meetapp/ui";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActionErrorNotice } from "../../features/auth/index.ts";
import {
  LocalVideo,
  leaveMeeting,
  useLobbyStatus,
  usePreJoinDevices,
  useVisit,
  type PreJoinDevices,
  type Joined,
} from "../../features/meetings/index.ts";

export interface LobbyPageProps {
  /** As shown on the own tile: the person's name. */
  name: string;
  onAdmitted: (visit: Joined) => void;
  onOutcome: (visit: Joined) => void;
  onLeft: () => void;
}

/** Moves on as soon as the status is no longer "waiting". */
function useOutcome({ onAdmitted, onOutcome }: Pick<LobbyPageProps, "onAdmitted" | "onOutcome">) {
  const visit = useVisit((state) => state.visit);
  const status = useLobbyStatus(visit);
  useEffect(() => {
    if (!visit || visit.status === "waiting") return;
    if (visit.status === "admitted" && visit.call) onAdmitted(visit);
    else if (visit.status !== "admitted") onOutcome(visit);
  }, [visit, onAdmitted, onOutcome]);
  return { visit, status };
}

function Controls({ devices, onLeave }: { devices: PreJoinDevices; onLeave: () => void }) {
  const { t } = useTranslation();
  const { prefs, change } = devices;
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <IconButton
        icon={prefs.microphoneOn ? "mic" : "mic-off"}
        off={!prefs.microphoneOn}
        label={prefs.microphoneOn ? t("meetings.devices.micOff") : t("meetings.devices.micOn")}
        onClick={() => change({ microphoneOn: !prefs.microphoneOn })}
      />
      <IconButton
        icon={prefs.cameraOn ? "camera" : "camera-off"}
        off={!prefs.cameraOn}
        label={prefs.cameraOn ? t("meetings.devices.cameraOff") : t("meetings.devices.cameraOn")}
        onClick={() => change({ cameraOn: !prefs.cameraOn })}
      />
      <Button variant="danger" icon="leave" onClick={onLeave}>
        {t("meetings.lobby.leave")}
      </Button>
    </div>
  );
}

export function LobbyPage({ name, onAdmitted, onOutcome, onLeft }: LobbyPageProps) {
  const { t } = useTranslation();
  const { visit, status } = useOutcome({ onAdmitted, onOutcome });
  const end = useVisit((state) => state.end);
  const devices = usePreJoinDevices();
  const { prefs, camera } = devices;
  const leave = () => void leaveMeeting(visit).then(() => (end(), onLeft()));
  return (
    <main className="flex min-h-screen flex-col gap-8 bg-bg px-6 py-8 text-ink sm:px-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <span className="text-[20px] font-bold">{t("auth.brand")}</span>
        <span className="text-[13px] text-ink-muted">{t("meetings.lobby.joiningAs", { name })}</span>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="w-105 max-w-full">
          <VideoTile
            name={name}
            cameraOff={!prefs.cameraOn || !camera.stream}
            {...(camera.stream ? { video: <LocalVideo stream={camera.stream} /> } : {})}
            {...(prefs.microphoneOn ? {} : { mutedLabel: t("meetings.devices.muted") })}
          />
        </div>
        <div className="flex flex-col items-center gap-2.5">
          <h1 tabIndex={-1} className="m-0 text-[26px] leading-8 font-bold tracking-[-0.01em] outline-none">
            {visit?.title ?? ""}
          </h1>
          <div className="flex items-center gap-2.5 text-ink-muted">
            <Spinner size={18} />
            <span role="status">{t("meetings.lobby.waiting")}</span>
          </div>
        </div>
        <Controls devices={devices} onLeave={leave} />
        {status.isError ? <ActionErrorNotice error={status.error} onRetry={() => void status.refetch()} /> : null}
      </div>
    </main>
  );
}
