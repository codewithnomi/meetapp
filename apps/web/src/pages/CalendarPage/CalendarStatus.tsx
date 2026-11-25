// The note above the calendar (AC-F13-01, 26): offline, failed with Retry, loading, too many, or empty.
import { Notice, Spinner } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import type { useCalendar } from "../../features/scheduling/index.ts";

export function Status({
  online,
  calendar,
  empty,
}: {
  online: boolean;
  calendar: ReturnType<typeof useCalendar>;
  empty: boolean;
}) {
  const { t } = useTranslation();
  if (!online)
    return (
      <Notice tone="neutral" icon="signal" className="m-3">
        {t("calendar.offline")}
      </Notice>
    );
  if (calendar.isError && !calendar.data)
    return (
      <Notice
        tone="danger"
        className="m-3"
        action={{ label: t("calendar.retry"), onClick: () => void calendar.refetch() }}
      >
        {t("calendar.failed")}
      </Notice>
    );
  if (calendar.isPending) return <Spinner label={t("calendar.loading")} className="m-3" />;
  if (calendar.data?.truncated)
    return (
      <Notice tone="neutral" className="m-3">
        {t("calendar.truncated")}
      </Notice>
    );
  if (empty) return <p className="m-0 px-5 py-3 text-[14px] text-ink-muted">{t("calendar.empty")}</p>;
  return null;
}
