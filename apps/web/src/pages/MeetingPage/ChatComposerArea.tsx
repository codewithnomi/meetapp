// The message box in the meeting chat (F03): replying shows the quote above the box; editing fills the
// box with the message and Save replaces it; the poll button opens "Create a poll" for those allowed;
// "sending too fast" is said in words (AC-F03-06, 10, 14, 21).
import type { ChatMessageView, MessageDocument } from "@meetapp/contracts";
import { ChatComposer, IconButton, PollCreator, ReplyQuote } from "@meetapp/ui";
import { composerLabels, pollLabels } from "./chat-labels.ts";
import type { Attachments } from "./chat-attachments.ts";
import { ToolButtons, WaitingFiles, useExpressions } from "./ChatTools.tsx";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createPoll, editMessage, type Outgoing, type UploadProblem } from "../../features/meetings/chat/index.ts";
import { firstLineOf } from "./chat-texts.ts";
import type { ChatView } from "./ChatMessages.tsx";
import type { ChatPlace } from "../../features/meetings/chat/index.ts";

function PollButton({ place, onFailed }: { place: ChatPlace; onFailed: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const labels = pollLabels(t);
  return (
    <>
      <IconButton
        icon="poll"
        label={t("meetings.chat.newPoll.button")}
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
      />
      <PollCreator
        open={open}
        onOpenChange={setOpen}
        busy={busy}
        labels={labels}
        onPost={(poll) => {
          setBusy(true);
          void createPoll(place, poll)
            .then(() => setOpen(false), onFailed)
            .finally(() => setBusy(false));
        }}
      />
    </>
  );
}

export interface ComposerAreaProps {
  view: ChatView;
  place: ChatPlace;
  /** Instead of "Message everyone" (F14 chats: "Message <name>"). */
  placeholder?: string | undefined;
  attachments: Attachments;
  replyingTo: ChatMessageView | undefined;
  editing: ChatMessageView | undefined;
  onDone: () => void;
}

const REFUSED = {
  CHAT_FILE_TOO_BIG: "meetings.chat.files.tooBig",
  CHAT_FILE_TYPE: "meetings.chat.files.wrongKind",
  CHAT_FILE_RATE: "meetings.chat.files.tooMany",
  CHAT_MEETING_FILES_FULL: "meetings.chat.files.meetingFull",
  CHAT_OFF: "meetings.chat.off",
  failed: "meetings.chat.files.failed",
} as const satisfies Record<UploadProblem, string>;

/** Notes above the box: sending too fast, and a file that was refused. */
function Notes({ view, attachments }: { view: ChatView; attachments: Attachments }) {
  const { t } = useTranslation();
  const refused = attachments.refused;
  return (
    <>
      {view.chat.state.tooFast ? (
        <p role="alert" className="m-0 rounded-md bg-warning-soft p-2.5 text-[13px] text-ink">
          {t("meetings.chat.tooFast")}
        </p>
      ) : null}
      {refused ? (
        <p role="alert" className="m-0 rounded-md bg-danger-soft p-2.5 text-[13px] text-ink">
          {t(REFUSED[refused.problem], { name: refused.name })}
        </p>
      ) : null}
    </>
  );
}

/** Above the text: the reply or edit quote and the files waiting. */
function Above({ props }: { props: ComposerAreaProps }) {
  const { t } = useTranslation();
  const { attachments, replyingTo, editing, onDone } = props;
  const quote = editing ?? replyingTo;
  return (
    <>
      {quote ? (
        <ReplyQuote
          senderName={quote.sender.name}
          firstLine={firstLineOf(quote)}
          composing={{
            title: editing ? t("meetings.chat.editing") : t("meetings.chat.replyingTo", { name: quote.sender.name }),
            cancelLabel: t(editing ? "meetings.chat.cancelEdit" : "meetings.chat.cancelReply"),
            onCancel: onDone,
          }}
        />
      ) : null}
      <WaitingFiles attachments={attachments} />
    </>
  );
}

/** Saves an edit, or sends the text with the files waiting (AC-F03-10, 28). */
function sendFrom({ view, place, attachments, replyingTo, editing }: ComposerAreaProps, body: MessageDocument) {
  if (editing) {
    void editMessage(place, editing.id, body).catch(view.onFailed);
    return;
  }
  const attachmentIds = attachments.readyIds;
  const content = {
    ...(body.blocks.length > 0 ? { body } : {}),
    ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
  };
  view.chat.send(content, undefined, replyingTo?.id);
  attachments.clear();
}

export function ComposerArea(props: ComposerAreaProps) {
  const { t } = useTranslation();
  const { view, place, attachments, replyingTo, editing, onDone } = props;
  // A GIF or sticker goes at once, with the reply if replying.
  const expressions = useExpressions(place, (content: Outgoing) => {
    view.chat.send(content, undefined, replyingTo?.id);
    onDone();
  });
  const labels = { ...composerLabels(t), ...(props.placeholder ? { placeholder: props.placeholder } : {}) };
  const send = (body: MessageDocument) => (sendFrom(props, body), onDone());
  const tools = (
    <>
      <ToolButtons canAttach={view.rights.attach} onFiles={attachments.add} />
      {view.rights.createPoll ? <PollButton place={place} onFailed={view.onFailed} /> : null}
    </>
  );
  return (
    <>
      <Notes view={view} attachments={attachments} />
      <ChatComposer
        key={editing?.id ?? "new"}
        initial={editing?.body ?? undefined}
        labels={editing ? { ...labels, send: t("meetings.chat.save") } : labels}
        tooManyLabel={(over) => t("meetings.chat.tooMany", { count: over })}
        onSend={(body) => send(body as MessageDocument)}
        allowEmpty={!editing && attachments.readyIds.length > 0}
        waiting={!editing && attachments.busy}
        onEscape={(editing ?? replyingTo) ? onDone : undefined}
        onPasteFiles={view.rights.attach ? attachments.add : undefined}
        above={<Above props={props} />}
        tools={tools}
        expressions={expressions}
      />
    </>
  );
}
