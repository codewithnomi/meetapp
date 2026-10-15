// MeetingEndedPage (page): the message that ends a visit (approved "Messages" canvas): denied, nobody let
// you in (15 minutes, AC-F02-18), removed (by whom, AC-F02-35), the meeting ended, locked, guests not
// allowed, or a connection lost for over 30 seconds with Rejoin (AC-F02-29). One card, read out at once.
import { MessageCard, type IconName } from "@meetapp/ui";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { Attendance } from "../../features/meetings/index.ts";

export interface MeetingEndedPageProps {
  outcome: Pick<Attendance, "status" | "leftReason" | "actedByName"> | undefined;
  onHome: () => void;
  /** "Try again" after waiting too long: back to Join a meeting. */
  onTryAgain: () => void;
  /** After a lost connection: Rejoin, with its waiting state and what went wrong. */
  rejoin?: { onRejoin: () => void; pending: boolean; error: string | undefined } | undefined;
}

type Outcome = "denied" | "timedOut" | "removed" | "ended" | "locked" | "noGuests" | "lost" | "left";

function outcomeOf(outcome: MeetingEndedPageProps["outcome"]): Outcome {
  if (!outcome) return "left";
  if (outcome.status === "denied") return "denied";
  if (outcome.status === "timed_out") return "timedOut";
  if (outcome.status === "removed") return "removed";
  if (outcome.leftReason === "ended") return "ended";
  if (outcome.leftReason === "locked") return "locked";
  if (outcome.leftReason === "guests_off") return "noGuests";
  if (outcome.leftReason === "dropped") return "lost";
  return "left";
}

const LOOK: Record<Outcome, { icon: IconName; tone: "neutral" | "warning" | "danger" }> = {
  denied: { icon: "close", tone: "danger" },
  timedOut: { icon: "clock", tone: "warning" },
  removed: { icon: "users", tone: "danger" },
  ended: { icon: "check", tone: "neutral" },
  locked: { icon: "lock", tone: "neutral" },
  noGuests: { icon: "users", tone: "neutral" },
  lost: { icon: "signal", tone: "warning" },
  left: { icon: "check", tone: "neutral" },
};

/** The second button: Try again after a long wait, Rejoin after a lost connection. */
function extraAction(t: TFunction, which: Outcome, props: MeetingEndedPageProps) {
  if (which === "timedOut") return { secondary: { label: t("meetings.ended.tryAgain"), onClick: props.onTryAgain } };
  if (which === "lost" && props.rejoin && !props.rejoin.pending)
    return { secondary: { label: t("meetings.ended.rejoin"), onClick: props.rejoin.onRejoin } };
  return {};
}

export function MeetingEndedPage(props: MeetingEndedPageProps) {
  const { outcome, onHome } = props;
  const { t } = useTranslation();
  const which = outcomeOf(outcome);
  const by = outcome?.actedByName ?? t("meetings.ended.someone");
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-6 text-ink">
      <MessageCard
        {...LOOK[which]}
        className="w-full max-w-100"
        headingLevel={1}
        live="assertive"
        title={t(`meetings.ended.${which}.title`)}
        body={props.rejoin?.error ?? t(`meetings.ended.${which}.body`, { name: by })}
        primary={{ label: t("meetings.ended.home"), onClick: onHome }}
        {...extraAction(t, which, props)}
      />
    </main>
  );
}
