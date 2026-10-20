// The extra tools of the meeting chat's message box (F03): Attach (not for guests), GIF (when the
// workspace allows them; searched at KLIPY by the app, with a one-time notice), and Sticker; plus the
// files waiting to be sent, with progress, "Upload failed" and Retry (AC-F03-24–29, 33).
import { STICKERS, type ChatMessageView } from "@meetapp/contracts";
import { FileChip, GifPicker, IconButton, StickerPicker } from "@meetapp/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { gifSettings, searchGifs, type FoundGif } from "../../features/meetings/chat/index.ts";
import type { Joined } from "../../features/meetings/index.ts";
import type { Attachments } from "./chat-attachments.ts";
import { sizeText } from "./ChatExtras.tsx";

export type OpenPicker = "gif" | "sticker" | undefined;
const NOTICE_KEY = "meetapp.chat.gifNoticeSeen";
const SEARCH_DELAY_MS = 300;

const seenNotice = () => {
  try {
    return localStorage.getItem(NOTICE_KEY) === "yes";
  } catch {
    return false;
  }
};

/** The GIF settings for this call; undefined (button hidden) when the workspace turned GIFs off. */
export function useGifSettings(visit: Joined) {
  return useQuery({
    queryKey: ["chat-gif-settings", visit.call?.callId],
    queryFn: () => gifSettings(visit),
    retry: false,
    staleTime: Infinity,
  });
}

function useGifSearch(settings: Awaited<ReturnType<typeof gifSettings>> | undefined, query: string) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "ready" | "unavailable"; results: FoundGif[] }>({
    status: "idle",
    results: [],
  });
  useEffect(() => {
    if (!settings?.available) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (query.trim() === "") return;
      setState((old) => ({ ...old, status: "loading" }));
      searchGifs(settings, query.trim(), AbortSignal.any([controller.signal, AbortSignal.timeout(2_000)])).then(
        (results) => setState({ status: "ready", results }),
        () => !controller.signal.aborted && setState({ status: "unavailable", results: [] }),
      );
    }, SEARCH_DELAY_MS);
    return () => (clearTimeout(timer), controller.abort());
  }, [settings, query]);
  return settings && !settings.available ? { status: "unavailable" as const, results: [] } : state;
}

/** "Your search words go to the GIF service", shown once on this computer (AC-F03-27). */
function useGifNotice() {
  const [seen, setSeen] = useState(seenNotice);
  const gotIt = () => {
    setSeen(true);
    try {
      localStorage.setItem(NOTICE_KEY, "yes");
    } catch {
      // Shown again next time.
    }
  };
  return { seen, gotIt };
}

export function GifPanel({
  visit,
  onPick,
}: {
  visit: Joined;
  onPick: (gif: NonNullable<ChatMessageView["gif"]>) => void;
}) {
  const { t } = useTranslation();
  const settings = useGifSettings(visit);
  const [query, setQuery] = useState("");
  const notice = useGifNotice();
  const search = useGifSearch(settings.data, query);
  return (
    <GifPicker
      query={query}
      onQuery={setQuery}
      results={search.results}
      status={search.status}
      reduceMotion={window.matchMedia("(prefers-reduced-motion: reduce)").matches}
      onPick={(gif) =>
        onPick({
          id: gif.id,
          description: gif.description,
          url: gif.url,
          ...(gif.stillUrl ? { stillUrl: gif.stillUrl } : {}),
          width: gif.width,
          height: gif.height,
        })
      }
      notice={
        notice.seen
          ? undefined
          : { text: t("meetings.chat.gifs.notice"), gotIt: t("meetings.chat.gifs.gotIt"), onGotIt: notice.gotIt }
      }
      labels={{
        search: t("meetings.chat.gifs.search"),
        loading: t("meetings.chat.gifs.loading"),
        unavailable: t("meetings.chat.gifs.unavailable"),
        attribution: t("meetings.chat.gifs.attribution"),
      }}
    />
  );
}

export function StickerPanel({ onPick }: { onPick: (name: (typeof STICKERS)[number]) => void }) {
  const { t } = useTranslation();
  return (
    <StickerPicker
      label={t("meetings.chat.stickers.title")}
      stickers={STICKERS.map((name) => ({
        name,
        text: t(`meetings.chat.stickers.${name}`),
        label: t("meetings.chat.stickers.label", { name: t(`meetings.chat.stickers.${name}`) }),
      }))}
      onPick={(name) => onPick(name as (typeof STICKERS)[number])}
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
  canGif: boolean;
  open: OpenPicker;
  onOpen: (picker: OpenPicker) => void;
  onFiles: (files: File[]) => void;
}

export function ToolButtons({ canAttach, canGif, open, onOpen, onFiles }: ToolButtonsProps) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const toggle = (picker: Exclude<OpenPicker, undefined>) => onOpen(open === picker ? undefined : picker);
  return (
    <>
      {canGif ? (
        <IconButton
          icon="sparkle"
          label={t("meetings.chat.gifs.button")}
          variant="ghost"
          size="sm"
          active={open === "gif"}
          onClick={() => toggle("gif")}
        />
      ) : null}
      <IconButton
        icon="sticker"
        label={t("meetings.chat.stickers.button")}
        variant="ghost"
        size="sm"
        active={open === "sticker"}
        onClick={() => toggle("sticker")}
      />
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
