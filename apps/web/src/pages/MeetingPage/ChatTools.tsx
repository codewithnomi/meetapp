// The extra tools of the meeting chat's message box (F03): Attach (not for guests); the emoji, GIF and
// sticker popup with tabs, as in Teams (GIFs when the workspace allows them, searched or trending at KLIPY
// by the app, with a one-time notice); plus the files waiting to be sent, with progress, "Upload failed"
// and Retry (AC-F03-12, 24–29, 33).
import { STICKERS } from "@meetapp/contracts";
import { ExpressionPicker, FileChip, IconButton, type StickerPickerProps } from "@meetapp/ui";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Outgoing } from "../../features/meetings/chat/index.ts";
import { useGifPicker } from "./chat-gifs.ts";
import type { Joined } from "../../features/meetings/index.ts";
import type { Attachments } from "./chat-attachments.ts";
import { useEmojiSettings } from "./chat-emoji.ts";
import { sizeText } from "./ChatExtras.tsx";

function useStickerPicker(onPick: (name: (typeof STICKERS)[number]) => void): StickerPickerProps {
  const { t } = useTranslation();
  return {
    label: t("meetings.chat.stickers.title"),
    stickers: STICKERS.map((name) => ({
      name,
      text: t(`meetings.chat.stickers.${name}`),
      label: t("meetings.chat.stickers.label", { name: t(`meetings.chat.stickers.${name}`) }),
    })),
    onPick: (name) => onPick(name as (typeof STICKERS)[number]),
  };
}

const DEFAULT_FEATURED = ["😆", "🙂", "👍", "👏", "🎉", "❤️"];
const FEATURED = 6;

/**
 * The popup behind the message box's smiley: an emoji goes into the text; a GIF or sticker is sent at once
 * (with the reply, if replying), as in Teams.
 */
export function useExpressions(visit: Joined, sendNow: (content: Outgoing) => void) {
  const { t } = useTranslation();
  const emoji = useEmojiSettings();
  const gifs = useGifPicker(visit, (gif) => sendNow({ gif }));
  const stickers = useStickerPicker((sticker) => sendNow({ sticker }));
  const featured = [...new Set([...emoji.settings.recent, ...DEFAULT_FEATURED])].slice(0, FEATURED);
  return (insert: (emoji: string) => void, close: () => void) => (
    <ExpressionPicker
      label={t("meetings.chat.expressions.label")}
      tabs={{
        all: t("meetings.chat.expressions.all"),
        emoji: t("meetings.chat.expressions.emoji"),
        gifs: t("meetings.chat.expressions.gifs"),
        stickers: t("meetings.chat.expressions.stickers"),
      }}
      seeAll={t("meetings.chat.expressions.seeAll")}
      searchLabel={t("meetings.chat.expressions.search")}
      emoji={{ ...emoji.settings, onPick: (picked) => (emoji.used(picked), insert(picked)) }}
      featured={featured.map((item) => ({ emoji: item, label: item }))}
      gifs={gifs ? { ...gifs, onPick: (gif) => (gifs.onPick(gif), close()) } : undefined}
      stickers={{ ...stickers, onPick: (name) => (stickers.onPick(name), close()) }}
      onClose={close}
    />
  );
}

export function WaitingFiles({ attachments }: { attachments: Attachments }) {
  const { t } = useTranslation();
  if (attachments.waiting.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {attachments.waiting.map((item) => (
        <FileChip
          key={item.key}
          text={
            item.state === "uploading"
              ? `${item.file.name} · ${String(item.percent)}%`
              : `${item.file.name} · ${sizeText(item.file.size)}`
          }
          state={item.state}
          uploadingLabel={t("meetings.chat.files.uploading", { name: item.file.name })}
          failed={{
            label: t("meetings.chat.files.failed"),
            retryLabel: t("meetings.chat.retry"),
            onRetry: () => attachments.retry(item),
          }}
          removeLabel={t("meetings.chat.files.remove", { name: item.file.name })}
          onRemove={() => attachments.remove(item.key)}
        />
      ))}
    </div>
  );
}

export interface ToolButtonsProps {
  canAttach: boolean;
  onFiles: (files: File[]) => void;
}

export function ToolButtons({ canAttach, onFiles }: ToolButtonsProps) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      {canAttach ? (
        <>
          <IconButton
            icon="paperclip"
            label={t("meetings.chat.files.attach")}
            variant="ghost"
            size="sm"
            onClick={() => input.current?.click()}
          />
          <input
            ref={input}
            type="file"
            multiple
            hidden
            aria-hidden="true"
            accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv,.docx,.xlsx,.pptx"
            onChange={(event) => {
              onFiles([...(event.target.files ?? [])]);
              event.target.value = "";
            }}
          />
        </>
      ) : null}
    </>
  );
}
