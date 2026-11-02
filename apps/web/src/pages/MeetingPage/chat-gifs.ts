// GIFs in the meeting chat's popup (F03 AC-F03-24, 25, 27; D059): the workspace's GIF settings, the
// search (trending until something is typed) at KLIPY by the app itself, and the one-time notice before
// anything is asked of KLIPY.
import type { ChatMessageView } from "@meetapp/contracts";
import type { GifPickerProps } from "@meetapp/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { gifSettings, searchGifs, trendingGifs, type FoundGif } from "../../features/meetings/chat/index.ts";
import type { ChatPlace } from "../../features/meetings/chat/index.ts";
import { prefersReducedMotion } from "./reduced-motion.ts";
import { readSaved, save } from "./safe-storage.ts";

const NOTICE_KEY = "meetapp.chat.gifNoticeSeen";
const SEARCH_DELAY_MS = 300;
/** A GIF search that takes longer gives up and says GIFs aren't available. */
const SEARCH_TIMEOUT_MS = 2_000;

const seenNotice = () => readSaved(NOTICE_KEY) === "yes";

/** The GIF settings for this call; undefined (button hidden) when the workspace turned GIFs off. */
function useGifSettings(place: ChatPlace) {
  return useQuery({
    queryKey: ["chat-gif-settings", place.path],
    queryFn: () => gifSettings(place),
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
      setState((old) => ({ ...old, status: "loading" }));
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(SEARCH_TIMEOUT_MS)]);
      // Nothing typed: what's trending, as in Teams.
      const found = query.trim() === "" ? trendingGifs(settings, signal) : searchGifs(settings, query.trim(), signal);
      found.then(
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
    save(NOTICE_KEY, "yes");
  };
  return { seen, gotIt };
}

/** The GIF part of the popup; undefined when the workspace turned GIFs off (AC-F03-25, 27). */
export function useGifPicker(place: ChatPlace, onPick: (gif: NonNullable<ChatMessageView["gif"]>) => void) {
  const { t } = useTranslation();
  const settings = useGifSettings(place);
  const [query, setQuery] = useState("");
  const notice = useGifNotice();
  const search = useGifSearch(notice.seen ? settings.data : undefined, query);
  if (!settings.data) return undefined;
  const picker: GifPickerProps = {
    query,
    onQuery: setQuery,
    results: search.results,
    status: search.status,
    reduceMotion: prefersReducedMotion(),
    onPick: (gif) =>
      onPick({
        id: gif.id,
        description: gif.description,
        url: gif.url,
        ...(gif.stillUrl ? { stillUrl: gif.stillUrl } : {}),
        width: gif.width,
        height: gif.height,
      }),
    notice: notice.seen
      ? undefined
      : { text: t("meetings.chat.gifs.notice"), gotIt: t("meetings.chat.gifs.gotIt"), onGotIt: notice.gotIt },
    labels: {
      search: t("meetings.chat.gifs.search"),
      loading: t("meetings.chat.gifs.loading"),
      unavailable: t("meetings.chat.gifs.unavailable"),
      attribution: t("meetings.chat.gifs.attribution"),
    },
  };
  return picker;
}
