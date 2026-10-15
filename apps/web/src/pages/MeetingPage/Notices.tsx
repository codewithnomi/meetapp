// Messages over the stage (canvas "Messages"): "X muted you" (with Unmute), "Your share ended", "The
// meeting ends in 10 minutes", and a short note when an action was refused. Each is read out once.
import { MessageCard } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import type { CallNotice } from "./call-events.ts";

export interface NoticesProps {
  notice: CallNotice | undefined;
  failed: boolean;
  onUnmute: () => void;
  onDismiss: () => void;
  onDismissFailed: () => void;
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

export function Notices({ notice, failed, onUnmute, onDismiss, onDismissFailed }: NoticesProps) {
  const { t } = useTranslation();
  if (!notice && !failed) return null;
  return (
    <>
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
