// PollCreator (organism): the "Create a poll" window of the approved "Chat: polls" screen (F03
// AC-F03-21): a question up to 200 characters, 2 to 10 answers up to 100 characters each, one answer or
// several, anonymous or with names. Post is offered only when the poll is complete. Words arrive as props.
import { useState } from "react";
import { Button } from "../../atoms/Button/index.ts";
import { IconButton } from "../../atoms/IconButton/index.ts";
import { Input } from "../../atoms/Input/index.ts";
import { Toggle } from "../../atoms/Toggle/index.ts";
import { Dialog } from "../../molecules/Dialog/index.ts";

export interface NewPoll {
  question: string;
  options: string[];
  multiple: boolean;
  anonymous: boolean;
}

export interface PollCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPost: (poll: NewPoll) => void;
  busy?: boolean;
  labels: {
    title: string;
    description: string;
    close: string;
    question: string;
    questionHint: string;
    answers: string;
    /** "Answer 1", with the number filled by the page. */
    answer: (index: number) => string;
    removeAnswer: (index: number) => string;
    addAnswer: string;
    multiple: string;
    anonymous: string;
    anonymousHint: string;
    cancel: string;
    post: string;
  };
}

const LIMITS = { question: 200, option: 100, min: 2, max: 10 };

interface AnswersProps {
  options: string[];
  setOptions: (options: string[]) => void;
  labels: PollCreatorProps["labels"];
}

/** 2 to 10 answers, each up to 100 characters. */
function Answers({ options, setOptions, labels }: AnswersProps) {
  const setOption = (index: number, value: string) => setOptions(options.map((old, i) => (i === index ? value : old)));
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 px-4 text-[13px] font-[550] text-ink">{labels.answers}</legend>
      {options.map((option, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <Input
              id={`poll-answer-${String(index)}`}
              aria-label={labels.answer(index + 1)}
              value={option}
              maxLength={LIMITS.option}
              onChange={(event) => setOption(index, event.target.value)}
            />
          </div>
          {options.length > LIMITS.min ? (
            <IconButton
              icon="close"
              label={labels.removeAnswer(index + 1)}
              variant="ghost"
              size="sm"
              onClick={() => setOptions(options.filter((_, i) => i !== index))}
            />
          ) : null}
        </div>
      ))}
      {options.length < LIMITS.max ? (
        <div>
          <Button variant="ghost" size="sm" icon="plus" onClick={() => setOptions([...options, ""])}>
            {labels.addAnswer}
          </Button>
        </div>
      ) : null}
    </fieldset>
  );
}

function Footer(props: { busy: boolean; ready: boolean; labels: PollCreatorProps["labels"]; onCancel: () => void }) {
  const { busy, ready, labels, onCancel } = props;
  return (
    <div className="flex justify-end gap-2">
      <Button variant="secondary" onClick={onCancel}>
        {labels.cancel}
      </Button>
      {busy ? (
        <Button type="submit" loading loadingLabel={labels.post}>
          {labels.post}
        </Button>
      ) : (
        <Button type="submit" disabled={!ready}>
          {labels.post}
        </Button>
      )}
    </div>
  );
}

export function PollCreator({ open, onOpenChange, onPost, busy = false, labels }: PollCreatorProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const filled = options.map((option) => option.trim()).filter(Boolean);
  const ready = question.trim() !== "" && filled.length >= LIMITS.min;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={labels.title}
      description={labels.description}
      closeLabel={labels.close}
      hideDescription
      initialFocusId="poll-question"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) onPost({ question: question.trim(), options: filled, multiple, anonymous });
        }}
      >
        <Input
          id="poll-question"
          label={labels.question}
          hint={labels.questionHint}
          value={question}
          maxLength={LIMITS.question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <Answers options={options} setOptions={setOptions} labels={labels} />
        <Toggle id="poll-multiple" label={labels.multiple} checked={multiple} onChange={setMultiple} />
        <Toggle
          id="poll-anonymous"
          label={labels.anonymous}
          description={labels.anonymousHint}
          checked={anonymous}
          onChange={setAnonymous}
        />
        <Footer busy={busy} ready={ready} labels={labels} onCancel={() => onOpenChange(false)} />
      </form>
    </Dialog>
  );
}
