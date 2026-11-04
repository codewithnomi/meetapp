// The person's picture at the top right with the status menu (approved canvas "Desktop app (F04)";
// AC-F04-20, 21), and the menu-bar or tray's status choices, which last until changed (AC-F04-05).
import { StatusMenu, type StatusDuration } from "@meetapp/ui";
import type { Status } from "@meetapp/contracts";
import { useTranslation } from "react-i18next";
import { apiFileUrl } from "../api/index.ts";
import { useSession, useSignOut } from "../auth/index.ts";
import { useTrayCommands } from "../desktop-app/index.ts";
import { useMyStatus } from "./use-my-status.ts";

const STATUSES: Status[] = ["available", "busy", "dnd", "brb", "away", "in_call", "offline"];
const DURATIONS: StatusDuration[] = ["30m", "1h", "2h", "today", "week", "forever"];

type Words = (key: "status.until" | "status.untilDay", values: { time: string; day?: string }) => string;

function endLabel(until: string | null, t: Words): string | null {
  if (!until) return null;
  const end = new Date(until);
  const today = end.toDateString() === new Date().toDateString();
  const time = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return today
    ? t("status.until", { time })
    : t("status.untilDay", { day: end.toLocaleDateString([], { weekday: "long" }), time });
}

export function MyStatusMenu({ onSettings }: { onSettings: () => void }) {
  const { t } = useTranslation();
  const { data: me } = useSession();
  const signOut = useSignOut();
  const { mine, duration, choose, reset } = useMyStatus();
  // Settings from the tray is handled by the app's desktop commands; status here.
  useTrayCommands({ onStatus: (status) => choose(status, "forever") });
  if (!me) return null;
  const statusLabels = Object.fromEntries(
    STATUSES.map((status) => [status, t(status === "away" ? "status.appearAway" : `chats.status.${status}`)]),
  ) as Record<Status, string>;
  // The picture shows Away as others see it; the menu offers "Appear away".
  statusLabels.away = mine?.chosen === "away" ? t("status.appearAway") : t("chats.status.away");
  return (
    <StatusMenu
      name={me.name}
      email={me.email}
      photo={apiFileUrl(me.photoUrl)}
      status={mine?.status ?? "available"}
      chosen={mine?.chosen ?? null}
      until={endLabel(mine?.until ?? null, (key, values) => t(key, values))}
      duration={duration}
      statusLabels={statusLabels}
      durationLabels={
        Object.fromEntries(DURATIONS.map((each) => [each, t(`status.for.${each}`)])) as Record<StatusDuration, string>
      }
      onChoose={choose}
      onReset={reset}
      words={{ menu: t("status.menu"), forHowLong: t("status.forHowLong"), reset: t("status.reset") }}
      actions={[
        { id: "settings", label: t("status.settings"), onSelect: onSettings },
        { id: "signOut", label: t("status.signOut"), onSelect: () => signOut.mutate() },
      ]}
    />
  );
}
