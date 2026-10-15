// PreJoinPage (page): the step before joining (approved canvases "Pre-join" and "Pre-join as a guest").
// For now it shows the meeting found or made and Cancel; the camera, sound, guest name and Join now
// arrive in the next step (F02 T13).
import { Button } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import type { PreJoinState } from "../../features/meetings/index.ts";

export interface PreJoinPageProps {
  meeting: PreJoinState | undefined;
  onCancel: () => void;
}

export function PreJoinPage({ meeting, onCancel }: PreJoinPageProps) {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-ink">
      <h1 tabIndex={-1} className="m-0 text-[26px] leading-8 font-bold outline-none">
        {meeting?.title ?? t("meetings.preJoin.missing")}
      </h1>
      <Button variant="ghost" onClick={onCancel}>
        {t("meetings.preJoin.cancel")}
      </Button>
    </main>
  );
}
