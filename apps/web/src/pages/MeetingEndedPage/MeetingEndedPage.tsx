// MeetingEndedPage (page): the message that ends a visit (approved "Messages" canvas): denied, nobody let
// you in (15 minutes, AC-F02-18), removed (by whom, AC-F02-35), the meeting ended, locked, or guests
// not allowed. One card, read out at once, with the way back.
import { MessageCard, type IconName } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import type { Attendance } from "../../features/meetings/index.ts";

export interface MeetingEndedPageProps {
  outcome: Pick<Attendance, "status" | "leftReason" | "actedByName"> | undefined;
  onHome: () => void;
  /** "Try again" after waiting too long: back to Join a meeting. */
  onTryAgain: () => void;
}

type Outcome = "denied" | "timedOut" | "removed" | "ended" | "locked" | "noGuests" | "left";

function outcomeOf(outcome: MeetingEndedPageProps["outcome"]): Outcome {
  if (!outcome) return "left";
  if (outcome.status === "denied") return "denied";
  if (outcome.status === "timed_out") return "timedOut";
  if (outcome.status === "removed") return "removed";
  if (outcome.leftReason === "ended") return "ended";
  if (outcome.leftReason === "locked") return "locked";
  if (outcome.leftReason === "guests_off") return "noGuests";
  return "left";
}

const LOOK: Record<Outcome, { icon: IconName; tone: "neutral" | "warning" | "danger" }> = {
  denied: { icon: "close", tone: "danger" },
  timedOut: { icon: "clock", tone: "warning" },
  removed: { icon: "users", tone: "danger" },
  ended: { icon: "check", tone: "neutral" },
  locked: { icon: "lock", tone: "neutral" },
  noGuests: { icon: "users", tone: "neutral" },
  left: { icon: "check", tone: "neutral" },
};

export function MeetingEndedPage({ outcome, onHome, onTryAgain }: MeetingEndedPageProps) {
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
        body={t(`meetings.ended.${which}.body`, { name: by })}
        primary={{ label: t("meetings.ended.home"), onClick: onHome }}
        {...(which === "timedOut" ? { secondary: { label: t("meetings.ended.tryAgain"), onClick: onTryAgain } } : {})}
      />
    </main>
  );
}
