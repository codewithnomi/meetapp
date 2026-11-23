// "This meeting / The series" for one meeting of a repeating series (F13 AC-F13-16, 18): asked before
// editing one, and before answering one.
import { Button, Dialog, SegmentedControl } from "@meetapp/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export type Scope = "occurrence" | "series";

export function ScopeDialog({
  kind,
  onChoose,
  onClose,
}: {
  kind: "edit" | "answer";
  onChoose: (scope: Scope) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<Scope>("occurrence");
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t(kind === "edit" ? "schedule.scope.editTitle" : "schedule.scope.answerTitle")}
      description={t(kind === "edit" ? "schedule.scope.editBody" : "schedule.scope.answerBody")}
      closeLabel={t("schedule.scope.back")}
    >
      <SegmentedControl
        label={t(kind === "edit" ? "schedule.scope.editTitle" : "schedule.scope.answerTitle")}
        options={[
          { value: "occurrence", label: t("schedule.scope.occurrence") },
          { value: "series", label: t(kind === "edit" ? "schedule.scope.series" : "schedule.scope.allSeries") },
        ]}
        value={scope}
        onChange={setScope}
      />
      <div className="flex justify-end gap-2.5">
        <Button variant="secondary" onClick={onClose}>
          {t("schedule.scope.back")}
        </Button>
        <Button onClick={() => onChoose(scope)}>{t("schedule.scope.continue")}</Button>
      </div>
    </Dialog>
  );
}
