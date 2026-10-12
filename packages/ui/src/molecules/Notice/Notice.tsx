// Notice (molecule): a short message in a form, as on the approved sign-in screens. "danger" is an
// error the user should act on (announced at once, role="alert"); "neutral" is quiet information
// (role="status"). An optional action, e.g. Retry when the backend can't be reached (AC-F01-29).
import { Button } from "../../atoms/Button/index.ts";
import { Icon, type IconName } from "../../atoms/Icon/index.ts";
import { cx } from "../../lib/cx.ts";

export interface NoticeProps {
  tone: "danger" | "neutral";
  /** Already translated. */
  children: string;
  icon?: IconName;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function Notice({ tone, children, icon = "lock", action, className }: NoticeProps) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx(
        "flex items-start gap-2.5 rounded-md px-4 py-3 text-[14px] leading-5 text-ink",
        tone === "danger" ? "bg-danger-soft" : "bg-surface-sunken",
        className,
      )}
    >
      <Icon name={icon} size={18} className="mt-px flex-none" />
      <span className="min-w-0 flex-1">{children}</span>
      {action ? (
        <Button variant="ghost" size="sm" className="-my-1.5" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
