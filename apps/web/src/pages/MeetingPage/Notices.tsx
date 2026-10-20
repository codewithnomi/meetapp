// Messages over the stage (canvas "Messages"): "Reconnecting…", "X muted you" (with Unmute), "Your share
// ended", "The meeting ends in 10 minutes", a device that was unplugged and what is used now, and a
// short note when an action was refused. Each is read out once.
import { MessageCard } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import type { DeviceGone } from "../../features/meetings/index.ts";
import type { CallNotice } from "./call-events.ts";

export interface NoticesProps {
  notice: CallNotice | undefined;
  failed: boolean;
  /** The call is starting: "Connecting…" until it answers. */
  connecting: boolean;
  reconnecting: boolean;
  gone: DeviceGone | undefined;
  onUnmute: () => void;
  onDismiss: () => void;
  onDismissFailed: () => void;
  onDismissGone: () => void;
}

function NoticeCard({
  notice,
  onUnmute,
  onDismiss,
}: {
  notice: CallNotice;
  onUnmute: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const ok = { label: t("meetings.call.dismiss"), onClick: onDismiss };
  if (notice.kind === "muted")
    return (
      <MessageCard
        icon="mic-off"
        tone="neutral"
        live="polite"
        className="max-w-100"
        title={t("meetings.call.mutedYou", { name: notice.by })}
        body={t("meetings.call.mutedYouBody")}
        primary={{ label: t("meetings.call.unmuteNow"), onClick: () => (onUnmute(), onDismiss()) }}
        secondary={ok}
      />
    );
  const ending = notice.kind === "endingSoon";
  return (
    <MessageCard
      icon={ending ? "clock" : "screen"}
      tone={ending ? "warning" : "neutral"}
      live="polite"
      className="max-w-100"
      title={t(ending ? "meetings.call.endingSoon" : "meetings.call.shareEnded")}
      body={t(ending ? "meetings.call.endingSoonBody" : "meetings.call.shareEndedBody")}
      primary={ok}
    />
  );
}

function Connection({ again }: { again: boolean }) {
  const { t } = useTranslation();
  return (
    <MessageCard
      icon="signal"
      tone={again ? "warning" : "neutral"}
      live="polite"
      className="max-w-100"
      title={t(again ? "meetings.call.reconnecting" : "meetings.call.connecting")}
      body={t(again ? "meetings.call.reconnectingBody" : "meetings.call.connectingBody")}
    />
  );
}

function Gone({ gone, onDismiss }: { gone: DeviceGone; onDismiss: () => void }) {
  const { t } = useTranslation();
  const what = gone.gone || t(`meetings.call.deviceKinds.${gone.kind}`);
  return (
    <MessageCard
      icon="sliders"
      tone="neutral"
      live="polite"
      className="max-w-100"
      title={t("meetings.call.deviceGone", { gone: what })}
      body={t("meetings.call.deviceNow", { now: gone.now || t("meetings.devices.defaultSpeakers") })}
      primary={{ label: t("meetings.call.dismiss"), onClick: onDismiss }}
    />
  );
}

export function Notices(props: NoticesProps) {
  const { t } = useTranslation();
  const { notice, failed, connecting, reconnecting, gone, onUnmute, onDismiss, onDismissFailed, onDismissGone } = props;
  if (!notice && !failed && !connecting && !reconnecting && !gone) return null;
  return (
    <>
      {connecting || reconnecting ? <Connection again={reconnecting} /> : null}
      {gone ? <Gone gone={gone} onDismiss={onDismissGone} /> : null}
      {notice ? <NoticeCard notice={notice} onUnmute={onUnmute} onDismiss={onDismiss} /> : null}
      {failed ? (
        <MessageCard
          icon="close"
          tone="neutral"
          live="polite"
          className="max-w-100"
          title={t("meetings.call.failed")}
          body={t("meetings.call.failedBody")}
          primary={{ label: t("meetings.call.dismiss"), onClick: onDismissFailed }}
        />
      ) : null}
    </>
  );
}
