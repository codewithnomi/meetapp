// PollCard (molecule): a poll in the chat, as in the approved "Chat: polls" screen (F03 AC-F03-21–23).
// One answer: the answers act as radio buttons; several: as check boxes. Choosing votes at once and can
// be changed until the poll closes. Results (bars, percentages and, for named polls, who) show only when
// `results` is given (after voting, or for the creator and organizers). Words arrive as props.
import { Badge } from "../../atoms/Badge/index.ts";
import { Button } from "../../atoms/Button/index.ts";
import { Icon } from "../../atoms/Icon/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface PollCardProps {
  question: string;
  /** "Poll by Aisha Khan · One answer · Names shown". */
  about: string;
  options: { id: string; text: string }[];
  multiple: boolean;
  /** The viewer's current choice. */
  chosen: string[];
  /** Shown when the viewer may see them. */
  /** `label` is "53% · 9" (made by the page). */
  results?: { options: { id: string; percent: number; label: string; names: string[] }[]; summary: string } | undefined;
  /** "Vote to see the results" and similar, when there are no results to show. */
  hint?: string | undefined;
  /** Set when closed: "Closed". */
  closedLabel?: string | undefined;
  onVote: (optionIds: string[]) => void;
  close?: { label: string; onClose: () => void } | undefined;
}

function Answer({ props, option }: { props: PollCardProps; option: { id: string; text: string } }) {
  const { multiple, chosen, results, closedLabel, onVote } = props;
  const isChosen = chosen.includes(option.id);
  const result = results?.options.find((r) => r.id === option.id);
  const next = multiple ? (isChosen ? chosen.filter((id) => id !== option.id) : [...chosen, option.id]) : [option.id];
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={isChosen}
      disabled={closedLabel !== undefined}
      onClick={() => next.length > 0 && onVote(next)}
      title={result && result.names.length > 0 ? result.names.join(", ") : undefined}
      className={cx(
        "relative flex min-h-11 w-full items-center gap-2.5 overflow-hidden rounded-full border bg-surface px-3.5 text-left text-[14px] text-ink",
        isChosen ? "border-accent ring-1 ring-accent" : "border-line-strong",
        closedLabel ? "cursor-default" : "cursor-pointer",
        FOCUS_RING,
      )}
    >
      {result ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-accent-soft"
          style={{ width: `${String(result.percent)}%` }}
        />
      ) : null}
      <span className="relative flex-1">{option.text}</span>
      {result ? <span className="relative font-semibold tabular-nums">{result.label}</span> : null}
    </button>
  );
}

export function PollCard(props: PollCardProps) {
  const { question, about, options, multiple, results, hint, closedLabel, close } = props;
  return (
    <section aria-label={question} className="flex max-w-90 flex-col gap-3 rounded-lg bg-surface p-4 text-ink shadow-1">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
        <Icon name="poll" size={16} />
        <span>{about}</span>
        {closedLabel ? <Badge>{closedLabel}</Badge> : null}
      </div>
      <h3 className="m-0 text-[16px] leading-5.5 font-semibold">{question}</h3>
      <div role={multiple ? "group" : "radiogroup"} aria-label={question} className="flex flex-col gap-2">
        {options.map((option) => (
          <Answer key={option.id} props={props} option={option} />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-ink-muted">{results?.summary ?? hint}</span>
        {close && !closedLabel ? (
          <Button variant="secondary" size="sm" onClick={close.onClose}>
            {close.label}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
