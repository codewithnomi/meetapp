// Notice (molecule): a short message in a form, as on the approved sign-in screens. "danger" is an
// error the user should act on (announced at once, role="alert"); "neutral" is quiet information
// (role="status"); "success" confirms something worked, quietly too, e.g. "Request sent" on the approved
// Join canvas, with a bold title. An optional action, e.g. Retry when the backend can't be reached
// (AC-F01-29).
import { Button } from "../../atoms/Button/index.ts";
import { Icon, type IconName } from "../../atoms/Icon/index.ts";
import { cx } from "../../lib/cx.ts";

export interface NoticeProps {
  tone: "danger" | "neutral" | "success";
  /** Already translated. */
  children: string;
  /** A bold first line above the text. */
  title?: string;
  icon?: IconName;
  action?: { label: string; onClick: () => void };
  className?: string;
}

const BACKGROUNDS = { danger: "bg-danger-soft", neutral: "bg-surface-sunken", success: "bg-success-soft" };

export function Notice({
  tone,
  children,
  title,
  icon = tone === "success" ? "check" : "lock",
  action,
  className,
}: NoticeProps) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx(
        "flex items-start gap-2.5 rounded-md px-4 py-3 text-[14px] leading-5 text-ink",
        BACKGROUNDS[tone],
        className,
      )}
    >
      <Icon name={icon} size={18} className="mt-px flex-none" />
      {title ? (
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-[650]">{title}</span>
          <span>{children}</span>
        </span>
      ) : (
        <span className="min-w-0 flex-1">{children}</span>
      )}
      {action ? (
        <Button variant="ghost" size="sm" className="-my-1.5" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
