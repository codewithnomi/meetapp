// "End the meeting for everyone?" (canvas "Messages", AC-F02-38): everyone, the lobby included, leaves
// at once, so it asks first.
import { Button, Dialog } from "@meetapp/ui";
import { useTranslation } from "react-i18next";

export function EndDialog({ onEnd, onClose }: { onEnd: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("meetings.end.title")}
      description={t("meetings.end.body")}
      closeLabel={t("meetings.end.cancel")}
    >
      <div className="flex flex-wrap justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>
          {t("meetings.end.cancel")}
        </Button>
        <Button variant="danger" onClick={onEnd}>
          {t("meetings.end.confirm")}
        </Button>
      </div>
    </Dialog>
  );
}
