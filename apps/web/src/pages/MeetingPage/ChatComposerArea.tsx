// The message box in the meeting chat (F03): replying shows the quote above the box; editing fills the
// box with the message and Save replaces it; the poll button opens "Create a poll" for those allowed;
// "sending too fast" is said in words (AC-F03-06, 10, 14, 21).
import type { ChatMessageView, MessageDocument } from "@meetapp/contracts";
import { ChatComposer, IconButton, PollCreator, ReplyQuote, type ChatComposerLabels } from "@meetapp/ui";
import type { Attachments } from "./chat-attachments.ts";
import { GifPanel, StickerPanel, ToolButtons, WaitingFiles, useGifSettings, type OpenPicker } from "./ChatTools.tsx";
import { useState } from "react";
import { useEmojiSettings } from "./chat-emoji.ts";
import { useTranslation } from "react-i18next";
import { createPoll, editMessage, type Outgoing, type UploadProblem } from "../../features/meetings/chat/index.ts";
import { firstLineOf } from "./chat-texts.ts";
import type { ChatView } from "./ChatMessages.tsx";
import type { Joined } from "../../features/meetings/index.ts";

const COMPOSER_KEYS = [
  "placeholder",
  "send",
  "format",
  "emoji",
  "formatting",
  "bold",
  "italic",
  "underline",
  "strike",
  "bulletList",
  "orderedList",
  "quote",
  "link",
  "linkAddress",
  "applyLink",
  "code",
  "codeBlock",
] as const;

const POLL_KEYS = [
  "title",
  "description",
  "close",
  "question",
  "questionHint",
  "answers",
  "addAnswer",
  "multiple",
  "anonymous",
  "anonymousHint",
  "cancel",
  "post",
] as const;

function PollButton({ visit, onFailed }: { visit: Joined; onFailed: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const words = Object.fromEntries(POLL_KEYS.map((key) => [key, t(`meetings.chat.newPoll.${key}`)]));
  const labels = {
    ...words,
    answer: (n: number) => t("meetings.chat.newPoll.answer", { n }),
    removeAnswer: (n: number) => t("meetings.chat.newPoll.removeAnswer", { n }),
  } as unknown as Parameters<typeof PollCreator>[0]["labels"];
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
          void createPoll(visit, poll)
            .then(() => setOpen(false), onFailed)
            .finally(() => setBusy(false));
        }}
      />
    </>
  );
}

export interface ComposerAreaProps {
  view: ChatView;
  visit: Joined;
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

/** Above the text: the reply or edit quote, files waiting, and an open GIF or sticker picker. */
function Above({ props, picker, onPicked }: { props: ComposerAreaProps; picker: OpenPicker; onPicked: () => void }) {
  const { t } = useTranslation();
  const { view, visit, attachments, replyingTo, editing, onDone } = props;
  const quote = editing ?? replyingTo;
  const sendExtra = (content: Outgoing) => (view.chat.send(content, undefined, replyingTo?.id), onPicked(), onDone());
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
      {picker === "gif" ? <GifPanel visit={visit} onPick={(gif) => sendExtra({ gif })} /> : null}
      {picker === "sticker" ? <StickerPanel onPick={(sticker) => sendExtra({ sticker })} /> : null}
    </>
  );
}

/** Saves an edit, or sends the text with the files waiting (AC-F03-10, 28). */
function sendFrom({ view, visit, attachments, replyingTo, editing }: ComposerAreaProps, body: MessageDocument) {
  if (editing) {
    void editMessage(visit, editing.id, body).catch(view.onFailed);
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
  const { view, visit, attachments, replyingTo, editing, onDone } = props;
  const emoji = useEmojiSettings();
  const gifs = useGifSettings(visit);
  const [picker, setPicker] = useState<OpenPicker>();
  const labels = Object.fromEntries(
    COMPOSER_KEYS.map((key) => [key, t(`meetings.chat.composer.${key}`)]),
  ) as unknown as ChatComposerLabels;
  const send = (body: MessageDocument) => (sendFrom(props, body), onDone());
  const tools = (
    <>
      <ToolButtons
        canAttach={view.rights.attach}
        canGif={Boolean(gifs.data)}
        open={picker}
        onOpen={setPicker}
        onFiles={attachments.add}
      />
      {view.rights.createPoll ? <PollButton visit={visit} onFailed={view.onFailed} /> : null}
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
        allowEmpty={!editing && attachments.readyIds.length > 0 && !attachments.busy}
        onEscape={(editing ?? replyingTo) ? onDone : picker ? () => setPicker(undefined) : undefined}
        onPasteFiles={view.rights.attach ? attachments.add : undefined}
        above={<Above props={props} picker={picker} onPicked={() => setPicker(undefined)} />}
        tools={tools}
        emoji={emoji.settings}
        onEmojiUsed={emoji.used}
      />
    </>
  );
}
