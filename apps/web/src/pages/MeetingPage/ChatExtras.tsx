// What a message carries besides text (F03): files (picture previews or file cards with Download),
// a GIF (paused in reduced motion, described in words), or one of our stickers.
import type { ChatMessageView } from "@meetapp/contracts";
import { AttachmentCard, GifImage, Sticker } from "@meetapp/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fileAddress, saveFile } from "../../features/meetings/chat/index.ts";
import type { Joined } from "../../features/meetings/index.ts";

type Attachment = ChatMessageView["attachments"][number];

/** Links work 5 minutes; previews are asked again before then. */
const LINK_FRESH_MS = 4 * 60 * 1000;

export function sizeText(bytes: number): string {
  if (bytes < 1024 * 1024) return `${String(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const KINDS: Record<string, string> = {
  "application/pdf": "PDF",
  "text/plain; charset=utf-8": "TXT",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/gif": "GIF",
  "image/webp": "WEBP",
};
const kindOf = (attachment: Attachment) =>
  KINDS[attachment.mediaType] ?? (attachment.fileName.split(".").pop() ?? "").toUpperCase();

function File({ visit, attachment, onFailed }: { visit: Joined; attachment: Attachment; onFailed: () => void }) {
  const { t } = useTranslation();
  const preview = useQuery({
    queryKey: ["chat-preview", attachment.id],
    queryFn: () => fileAddress(visit, attachment.id, true),
    enabled: attachment.hasPreview,
    staleTime: LINK_FRESH_MS,
    refetchInterval: LINK_FRESH_MS,
  });
  const download = () => void saveFile(visit, attachment.id).catch(onFailed);
  return (
    <AttachmentCard
      fileName={attachment.fileName}
      details={`${kindOf(attachment)} · ${sizeText(attachment.sizeBytes)}`}
      previewUrl={preview.data}
      previewLabel={t("meetings.chat.files.picture", { name: attachment.fileName })}
      onOpenPreview={download}
      downloadLabel={t("meetings.chat.files.download")}
      onDownload={download}
    />
  );
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function MessageExtras({
  visit,
  message,
  onFailed,
}: {
  visit: Joined;
  message: ChatMessageView;
  onFailed: () => void;
}) {
  const { t } = useTranslation();
  if (message.deletedAt) return null;
  return (
    <>
      {message.attachments.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {message.attachments.map((attachment) => (
            <File key={attachment.id} visit={visit} attachment={attachment} onFailed={onFailed} />
          ))}
        </div>
      ) : null}
      {message.gif ? (
        <GifImage
          url={message.gif.url}
          stillUrl={message.gif.stillUrl}
          description={t("meetings.chat.gifs.described", { description: message.gif.description })}
          width={message.gif.width}
          height={message.gif.height}
          reduceMotion={reducedMotion()}
          labels={{
            pause: t("meetings.chat.gifs.pause"),
            play: t("meetings.chat.gifs.play"),
            attribution: t("meetings.chat.gifs.attribution"),
          }}
        />
      ) : null}
      {message.sticker ? (
        <Sticker
          name={message.sticker}
          text={t(`meetings.chat.stickers.${message.sticker}`)}
          label={t("meetings.chat.stickers.label", { name: t(`meetings.chat.stickers.${message.sticker}`) })}
        />
      ) : null}
    </>
  );
}
