// GifPicker (molecule): search GIFs and pick one (F03 AC-F03-24, 27, approved screen "Chat: pickers").
// The page searches KLIPY from the app and passes the results in KLIPY's order (as KLIPY requires);
// the first time, a notice says the search words go to the GIF service. Words arrive as props.
import { Button } from "../../atoms/Button/index.ts";
import { Input } from "../../atoms/Input/index.ts";
import { Spinner } from "../../atoms/Spinner/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface GifResult {
  id: string;
  url: string;
  stillUrl?: string | undefined;
  description: string;
  width: number;
  height: number;
}

export interface GifPickerProps {
  query: string;
  onQuery: (query: string) => void;
  results: GifResult[];
  /** "loading" while searching; "unavailable" when GIFs can't be reached or aren't set up. */
  status: "idle" | "loading" | "ready" | "unavailable";
  onPick: (gif: GifResult) => void;
  /** Shown until the person presses "Got it". */
  notice?: { text: string; gotIt: string; onGotIt: () => void } | undefined;
  /** In reduced motion, still pictures are shown in the grid. */
  reduceMotion: boolean;
  labels: { search: string; loading: string; unavailable: string; attribution: string };
}

export function GifPicker(props: GifPickerProps) {
  const { query, onQuery, results, status, onPick, notice, reduceMotion, labels } = props;
  return (
    <div className="flex max-h-90 flex-col gap-2 rounded-md border border-line bg-surface-raised p-2 text-ink shadow-2">
      {notice ? (
        <div role="note" className="flex items-center gap-2.5 rounded-md bg-accent-soft p-2.5 text-[13px] leading-4.5">
          <span className="flex-1">{notice.text}</span>
          <Button variant="ghost" size="sm" onClick={notice.onGotIt}>
            {notice.gotIt}
          </Button>
        </div>
      ) : null}
      <Input
        id="gif-search"
        icon="search"
        type="search"
        aria-label={labels.search}
        placeholder={labels.search}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
      />
      {status === "loading" ? <Spinner label={labels.loading} /> : null}
      {status === "unavailable" ? <p className="m-0 p-2 text-[13px] text-ink-muted">{labels.unavailable}</p> : null}
      <div className="grid min-h-0 grid-cols-3 gap-1.5 overflow-y-auto">
        {results.map((gif) => (
          <button
            key={gif.id}
            type="button"
            aria-label={gif.description}
            onClick={() => onPick(gif)}
            className={cx("h-24 cursor-pointer overflow-hidden rounded-md border-0 bg-surface-sunken p-0", FOCUS_RING)}
          >
            <img
              src={reduceMotion && gif.stillUrl ? gif.stillUrl : gif.url}
              alt=""
              className="size-full object-cover"
            />
          </button>
        ))}
      </div>
      <span className="text-[11px] text-ink-muted">{labels.attribution}</span>
    </div>
  );
}
