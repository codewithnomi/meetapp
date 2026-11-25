// MeetingDetailsPanel (organism): the details of a scheduled meeting, as in the approved "Calendar: Meeting
// details" screen (F13): when and how it repeats, Join / Edit / Cancel meeting, the person's answer, the
// link, ID and passcode, a notice when invites couldn't be sent, who answered what, and the notes, whose
// web addresses can be clicked (AC-F13-28). All words arrive as props.
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Button } from "../../atoms/Button/index.ts";
import { Notice } from "../../molecules/Notice/index.ts";
import { SegmentedControl, type SegmentedOption } from "../../molecules/SegmentedControl/index.ts";
import { SidePanel } from "../../molecules/SidePanel/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

interface Action {
  label: string;
  onClick: () => void;
}

export interface DetailsPerson {
  key: string;
  name: string;
  photoUrl?: string | undefined;
  /** "Organizer", "Accepted", "Outside · email sent". */
  answer: string;
}

export interface MeetingDetailsPanelProps<A extends string> {
  title: string;
  closeLabel: string;
  onClose: () => void;
  /** "Wed 25 Nov · 10:00 – 10:30" and, for a series, "Every week on Wednesday". */
  when: string[];
  join?: Action | undefined;
  edit?: Action | undefined;
  cancel?: Action | undefined;
  /** Only for someone invited. */
  answer?:
    { label: string; options: readonly SegmentedOption<A>[]; value: A; onChange: (value: A) => void } | undefined;
  details: { label: string; value: string; mono?: boolean }[];
  /** "1 invite couldn't be sent." with Retry (organizers). */
  unsent?: { text: string; retry: Action } | undefined;
  people: { heading: string; list: DetailsPerson[] };
  notes?: { label: string; text: string } | undefined;
  /** "Cancelled" note, shown instead of the actions. */
  cancelledNote?: string | undefined;
}

// A full stop, comma or bracket at the end belongs to the sentence, not the address.
const URL_PART = /(https?:\/\/[^\s<>"]*[^\s<>".,;:!?)\]])/g;

/** Plain text with its web addresses as links that open outside the app. */
function Linked({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_PART).map((part, index) =>
        index % 2 === 1 ? (
          <a
            key={`${part}-${String(index)}`}
            href={part}
            target="_blank"
            rel="noreferrer noopener"
            className={cx("break-all text-accent-text hover:text-ink", FOCUS_RING)}
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Actions({ join, edit, cancel }: Pick<MeetingDetailsPanelProps<string>, "join" | "edit" | "cancel">) {
  if (!join && !edit && !cancel) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {join ? <Button onClick={join.onClick}>{join.label}</Button> : null}
      {edit ? (
        <Button variant="secondary" icon="edit" onClick={edit.onClick}>
          {edit.label}
        </Button>
      ) : null}
      {cancel ? (
        <Button variant="secondary" onClick={cancel.onClick}>
          {cancel.label}
        </Button>
      ) : null}
    </div>
  );
}

function People({ heading, list }: MeetingDetailsPanelProps<string>["people"]) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="m-0 text-[14px] font-semibold">{heading}</h3>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {list.map((person) => (
          <li key={person.key} className="flex items-center gap-2.5 text-[13px]">
            <Avatar name={person.name} size="sm" {...(person.photoUrl ? { src: person.photoUrl } : {})} />
            <span className="min-w-0 flex-1 truncate">{person.name}</span>
            <span className="text-ink-muted">{person.answer}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MeetingDetailsPanel<A extends string>(props: MeetingDetailsPanelProps<A>) {
  const { title, closeLabel, onClose, when, answer, details, unsent, people, notes, cancelledNote } = props;
  return (
    <SidePanel title={title} closeLabel={closeLabel} onClose={onClose} className="max-w-95 gap-4 overflow-y-auto">
      <p className="m-0 flex flex-col text-[13px] text-ink-muted">
        {when.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>
      {cancelledNote ? <Notice tone="neutral">{cancelledNote}</Notice> : <Actions {...props} />}
      {answer && !cancelledNote ? (
        <SegmentedControl
          label={answer.label}
          options={answer.options}
          value={answer.value}
          onChange={answer.onChange}
        />
      ) : null}
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
        {details.map((detail) => (
          <div key={detail.label} className="contents">
            <dt className="text-ink-muted">{detail.label}</dt>
            <dd className={cx("m-0 min-w-0 break-words", detail.mono && "font-mono font-semibold")}>{detail.value}</dd>
          </div>
        ))}
      </dl>
      {unsent ? (
        <Notice tone="danger" icon="mail" action={unsent.retry}>
          {unsent.text}
        </Notice>
      ) : null}
      <People {...people} />
      {notes ? (
        <section className="flex flex-col gap-1 text-[13px] leading-5">
          <h3 className="m-0 text-[13px] font-normal text-ink-muted">{notes.label}</h3>
          <p className="m-0 whitespace-pre-wrap">
            <Linked text={notes.text} />
          </p>
        </section>
      ) : null}
    </SidePanel>
  );
}
