// The incoming call on every screen of the app (F15 AC-F15-05, 06, 10, 32; design 2.3 and 3.4). Rings
// come from the live line; the chosen ringtone plays (a third as loud during another call). Accepting
// joins the call and then leaves the current call or meeting; declining stops the ring
// in every window. A ring nobody answers disappears when it expires.
import { IncomingCall, Notice } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { useAnswer, useRingtone, useRings } from "./incoming-call-hooks.ts";

export function IncomingCalls({ onAccepted }: { onAccepted: () => void }) {
  const { t } = useTranslation();
  const rings = useRings();
  const { accept, decline, busyIn } = useAnswer(onAccepted);
  useRingtone(rings.length > 0, busyIn !== undefined);
  if (rings.length === 0 && !accept.isError) return null;
  const busy = busyIn !== undefined;
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
      {accept.isError ? <Notice tone="danger">{t("calls.failed.join")}</Notice> : null}
      {rings.map((ring, index) => (
        <IncomingCall
          key={ring.callId}
          takeFocus={index === 0}
          label={t("calls.incoming.label")}
          callerName={ring.from.name}
          photoUrl={ring.from.photoUrl}
          subtitle={[ring.media === "video" ? t("calls.incoming.video") : t("calls.incoming.audio"), ring.groupName]
            .filter(Boolean)
            .join(" · ")}
          busyNote={busyIn === undefined ? undefined : t("calls.incoming.busy", { title: busyIn })}
          video={{
            label: busy ? t("calls.incoming.leave_acceptVideo") : t("calls.incoming.acceptVideo"),
            short: t("calls.incoming.videoShort"),
            onClick: () => accept.mutate({ ring, media: "video" }),
          }}
          audio={{
            label: busy ? t("calls.incoming.leave_acceptAudio") : t("calls.incoming.acceptAudio"),
            short: t("calls.incoming.audioShort"),
            onClick: () => accept.mutate({ ring, media: "audio" }),
          }}
          decline={{
            label: t("calls.incoming.decline"),
            short: t("calls.incoming.decline"),
            onClick: () => decline(ring),
          }}
        />
      ))}
    </div>
  );
}
