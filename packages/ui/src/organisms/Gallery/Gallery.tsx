// Gallery (organism): the meeting stage, as in the approved "Meeting: gallery" and "Meeting: speaker
// view" screens. Gallery: up to 16 tiles on a page (the page gives this page's tiles), in 1 to 4
// columns, with page arrows under them. Speaker: the first tile large, the next four in a strip, and
// "+ 18 more" for the rest. The tiles are VideoTiles the page makes. All words arrive as props.
// Tiles shrink to fit the height the frame gives (`--stage-height`, set by MeetingLayout), as in Teams:
// a full page of 16 shows without scrolling.
import type { ReactNode } from "react";
import { IconButton } from "../../atoms/IconButton/index.ts";
import { cx } from "../../lib/cx.ts";

export interface GalleryTile {
  /** Stable per person (their attendance id). */
  id: string;
  tile: ReactNode;
}

export interface GalleryPages {
  /** "Page 1 of 2 · 23 people". */
  text: string;
  /** Names the arrows' group: "Gallery pages". */
  label: string;
  previousLabel: string;
  nextLabel: string;
  onPrevious?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
}

export interface GalleryProps {
  /** "Participants' video, page 1 of 2" or "Speaker view". */
  label: string;
  layout: "gallery" | "speaker";
  tiles: GalleryTile[];
  /** Gallery only, when there is more than one page. */
  pages?: GalleryPages | undefined;
  /** Speaker only, when not everyone fits in the strip: "+ 18 more". */
  moreText?: string | undefined;
}

/** Four tiles in the strip, plus the "+ N more" box: the strip's 5 columns (grid-cols-5). */
const STRIP = 4;

const GAP_PX = 10;
/** The page arrows' row and the gap above it. */
const ARROWS_PX = 46;
const STAGE_HEIGHT = "var(--stage-height, 100dvh)";

/** 1 tile: 1 column; up to 4: 2; up to 9: 3; more: 4. */
function columnCount(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}
const COLUMNS = ["grid-cols-1", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"];

/** The widest the grid may be so that every row of 16:9 tiles fits the stage's height. */
function fitWidth(count: number, withArrows: boolean): string {
  const cols = columnCount(count);
  const rows = Math.max(1, Math.ceil(count / cols));
  const fixed = (withArrows ? ARROWS_PX : 0) + (rows - 1) * GAP_PX;
  return `calc((${STAGE_HEIGHT} - ${String(fixed)}px) / ${String(rows)} * 16 / 9 * ${String(cols)} + ${String((cols - 1) * GAP_PX)}px)`;
}

function PageArrows({ pages }: { pages: GalleryPages }) {
  return (
    <nav aria-label={pages.label} className="flex items-center justify-center gap-3 text-[13px] text-stage-ink">
      <IconButton
        icon="chevron-left"
        variant="ghost"
        size="sm"
        label={pages.previousLabel}
        disabled={!pages.onPrevious}
        onClick={pages.onPrevious}
        className="text-stage-ink"
      />
      <span>{pages.text}</span>
      <IconButton
        icon="chevron"
        variant="ghost"
        size="sm"
        label={pages.nextLabel}
        disabled={!pages.onNext}
        onClick={pages.onNext}
        className="text-stage-ink"
      />
    </nav>
  );
}

function SpeakerView({ tiles, moreText }: Pick<GalleryProps, "tiles" | "moreText">) {
  const [main, ...others] = tiles;
  const strip = others.slice(0, STRIP);
  return (
    <>
      {main ? (
        <div key={main.id} className="mx-auto w-full" style={{ maxWidth: `calc(${STAGE_HEIGHT} * 0.7 * 16 / 9)` }}>
          {main.tile}
        </div>
      ) : null}
      {strip.length > 0 || moreText ? (
        <ul
          className="m-0 mx-auto grid w-full list-none grid-cols-5 gap-2.5 p-0"
          // The strip takes the height the main tile leaves (30%), so it fits short, wide windows too.
          style={{
            maxWidth: `calc((${STAGE_HEIGHT} * 0.3 - ${String(GAP_PX)}px) * 16 / 9 * 5 + ${String(4 * GAP_PX)}px)`,
          }}
        >
          {strip.map(({ id, tile }) => (
            <li key={id}>{tile}</li>
          ))}
          {moreText ? (
            <li className="grid aspect-video place-items-center rounded-lg bg-stage-tile text-center text-[14px] font-semibold text-stage-ink">
              {moreText}
            </li>
          ) : null}
        </ul>
      ) : null}
    </>
  );
}

export function Gallery({ label, layout, tiles, pages, moreText }: GalleryProps) {
  return (
    <section aria-label={label} className="flex min-w-0 flex-col gap-3">
      {layout === "speaker" ? (
        <SpeakerView tiles={tiles} moreText={moreText} />
      ) : (
        <ul
          className={cx("m-0 mx-auto grid w-full list-none gap-2.5 p-0", COLUMNS[columnCount(tiles.length)])}
          style={{ maxWidth: fitWidth(tiles.length, Boolean(pages)) }}
        >
          {tiles.map(({ id, tile }) => (
            <li key={id}>{tile}</li>
          ))}
        </ul>
      )}
      {layout === "gallery" && pages ? <PageArrows pages={pages} /> : null}
    </section>
  );
}
