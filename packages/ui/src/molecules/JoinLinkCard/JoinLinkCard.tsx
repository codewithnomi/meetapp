// JoinLinkCard (molecule): the workspace's join link and join code, as on the approved "People" canvas
// (AC-F01-19). The owner and admins see the on/off switch and "Replace link and code"; everyone sees
// the link and code with Copy buttons while they are on. After a copy, the button says "Copied" for a
// moment (and screen readers hear it). The code shows in two groups of five; spaces and dashes don't
// matter when it is typed. All words arrive as props.
import { useEffect, useState } from "react";
import { Button } from "../../atoms/Button/index.ts";
import { Toggle } from "../../atoms/Toggle/index.ts";

export interface JoinLinkCardLabels {
  /** The switch's name, also the card's heading for members. */
  title: string;
  description: string;
  copyLink: string;
  copyCode: string;
  copied: string;
  replace: string;
  /** What members see while the link is off. */
  off: string;
}

export interface JoinLinkCardProps {
  enabled: boolean;
  link: string | null;
  code: string | null;
  /** The owner and admins: the switch and Replace. */
  canManage: boolean;
  /** While a change is being sent. */
  busy?: boolean;
  onToggle: (enabled: boolean) => void;
  onReplace: () => void;
  /** Puts the text on the clipboard; the card shows "Copied" once it resolves. */
  onCopy: (text: string) => Promise<void>;
  labels: JoinLinkCardLabels;
}

const COPIED_MS = 2000;
const PILL = "flex min-h-11 items-center gap-2.5 rounded-full bg-surface-sunken py-0 pr-2 pl-4.5";

/** "ABCDEFGHJK" → "ABCDE-FGHJK". */
const grouped = (code: string) => code.match(/.{1,5}/g)?.join("-") ?? code;

function useCopied() {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  return [copied, setCopied] as const;
}

function Secrets({
  link,
  code,
  onCopy,
  labels,
}: Pick<JoinLinkCardProps, "onCopy" | "labels"> & { link: string; code: string }) {
  const [copied, setCopied] = useCopied();
  const copy = (what: "link" | "code", text: string) => void onCopy(text).then(() => setCopied(what));
  return (
    <>
      <div className={`${PILL} min-w-0 flex-[1_1_320px]`}>
        <span className="min-w-0 flex-1 truncate text-[14px]">{link}</span>
        <Button variant="ghost" size="sm" icon="copy" onClick={() => copy("link", link)}>
          {copied === "link" ? labels.copied : labels.copyLink}
        </Button>
      </div>
      <div className={PILL}>
        <span className="font-mono text-[15px] font-semibold tracking-[0.08em]">{grouped(code)}</span>
        <Button variant="ghost" size="sm" icon="copy" onClick={() => copy("code", code)}>
          {copied === "code" ? labels.copied : labels.copyCode}
        </Button>
      </div>
      <span role="status" className="sr-only">
        {copied ? labels.copied : ""}
      </span>
    </>
  );
}

export function JoinLinkCard(props: JoinLinkCardProps) {
  const { enabled, link, code, canManage, busy = false, onToggle, onReplace, labels } = props;
  const on = enabled && link !== null && code !== null;
  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <Toggle
          id="join-link-on"
          label={labels.title}
          description={labels.description}
          checked={enabled}
          disabled={busy}
          onChange={onToggle}
        />
      ) : (
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-[550]">{labels.title}</span>
          <span className="text-[12px] leading-4 text-ink-muted">{on ? labels.description : labels.off}</span>
        </div>
      )}
      {on ? (
        <div className="flex flex-wrap gap-3">
          <Secrets link={link} code={code} onCopy={props.onCopy} labels={labels} />
          {canManage ? (
            <Button variant="secondary" disabled={busy} onClick={onReplace}>
              {labels.replace}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
