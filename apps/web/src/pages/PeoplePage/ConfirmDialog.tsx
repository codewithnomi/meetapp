// Asks before removing someone, handing the workspace over or leaving (AC-F01-21, 22, 23). The
// confirming button shows a spinner while the change is sent; a refusal shows inside the window.
import { Button, Dialog } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { ActionErrorNotice } from "../../features/auth/index.ts";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  pending: boolean;
  error: { code: string } | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const { t } = useTranslation();
  const { open, title, text, confirmLabel, pending, error, onConfirm, onCancel } = props;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? undefined : onCancel())}
      title={title}
      description={text}
      closeLabel={t("workspaces.people.confirm.close")}
    >
      <ActionErrorNotice error={error} onRetry={onConfirm} />
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>
          {t("workspaces.people.confirm.cancel")}
        </Button>
        {pending ? (
          <Button variant="danger" loading loadingLabel={t("workspaces.people.confirm.pending")}>
            {confirmLabel}
          </Button>
        ) : (
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
