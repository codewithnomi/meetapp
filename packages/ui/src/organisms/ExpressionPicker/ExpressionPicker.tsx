// ExpressionPicker (organism): emoji, GIFs and stickers in one popup with tabs, as in Microsoft Teams
// (owner, 2026-10-21): "All" shows a row of emoji, a few GIFs and a few stickers, each with "See all";
// the other tabs show the full emoji list, the GIF search and every sticker. The search on "All" searches
// GIFs. The GIFs tab is left out when the workspace turned GIFs off. Words and data arrive as props.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "../../atoms/Button/index.ts";
import { Icon } from "../../atoms/Icon/index.ts";
import { Input } from "../../atoms/Input/index.ts";
import { Sticker } from "../../atoms/Sticker/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";
import { useRadioGroup } from "../../lib/useRadioGroup.ts";
import { EmojiPicker, type EmojiPickerProps } from "../../molecules/EmojiPicker/index.ts";
import { GifPicker, type GifPickerProps } from "../../molecules/GifPicker/index.ts";
import { StickerPicker, type StickerPickerProps } from "../../molecules/StickerPicker/index.ts";

export type ExpressionTab = "all" | "emoji" | "gifs" | "stickers";

export interface ExpressionPickerProps {
  /** Names the popup: "Emoji, GIFs and stickers". */
  label: string;
  tabs: Record<ExpressionTab, string>;
  /** "See all". */
  seeAll: string;
  /** "Find something fun" (searches GIFs from the All tab). */
  searchLabel: string;
  emoji: EmojiPickerProps;
  /** The emoji in the All tab's row (recently used first). */
  featured: { emoji: string; label: string }[];
  /** Absent when GIFs are off for the workspace. */
  gifs?: GifPickerProps | undefined;
  stickers: StickerPickerProps;
  /** Escape inside the popup. */
  onClose: () => void;
}

const ALL_GIFS = 3;
const ALL_STICKERS = 4;

function Section({
  title,
  seeAll,
  onSeeAll,
  children,
}: {
  title: string;
  seeAll: string;
  onSeeAll: () => void;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="m-0 text-[14px] font-semibold">{title}</h3>
        <button
          type="button"
          onClick={onSeeAll}
          aria-label={`${seeAll}: ${title}`}
          className={cx(
            "inline-flex cursor-pointer items-center gap-0.5 rounded-sm border-0 bg-transparent text-[13px] text-ink-muted hover:text-ink",
            FOCUS_RING,
          )}
        >
          {seeAll}
          <Icon name="chevron" size={16} />
        </button>
      </div>
      {children}
    </section>
  );
}

const TILE = cx("cursor-pointer overflow-hidden rounded-md border-0 bg-surface-sunken p-0", FOCUS_RING);

type AllProps = ExpressionPickerProps & { show: (tab: ExpressionTab) => void };

function GifNotice({ notice }: { notice: NonNullable<GifPickerProps["notice"]> }) {
  return (
    <div role="note" className="flex items-center gap-2.5 rounded-md bg-accent-soft p-2.5 text-[13px] leading-4.5">
      <span className="flex-1">{notice.text}</span>
      <Button variant="ghost" size="sm" onClick={notice.onGotIt}>
        {notice.gotIt}
      </Button>
    </div>
  );
}

function EmojiRow({ tabs, seeAll, featured, emoji, show }: AllProps) {
  return (
    <Section title={tabs.emoji} seeAll={seeAll} onSeeAll={() => show("emoji")}>
      <div className="flex flex-wrap gap-1">
        {featured.map((item) => (
          <button
            key={item.emoji}
            type="button"
            aria-label={item.label}
            onClick={() => emoji.onPick(item.emoji)}
            className={cx(
              "size-10 cursor-pointer rounded-md border-0 bg-transparent text-[26px] leading-none hover:bg-surface-sunken",
              FOCUS_RING,
            )}
          >
            {item.emoji}
          </button>
        ))}
      </div>
    </Section>
  );
}

function GifRow({ tabs, seeAll, gifs, show }: AllProps & { gifs: GifPickerProps }) {
  return (
    <Section title={tabs.gifs} seeAll={seeAll} onSeeAll={() => show("gifs")}>
      {gifs.status === "unavailable" ? (
        <p className="m-0 text-[13px] text-ink-muted">{gifs.labels.unavailable}</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {gifs.results.slice(0, ALL_GIFS).map((gif) => (
            <button
              key={gif.id}
              type="button"
              aria-label={gif.description}
              onClick={() => gifs.onPick(gif)}
              className={cx("h-20", TILE)}
            >
              <img
                src={gifs.reduceMotion && gif.stillUrl ? gif.stillUrl : gif.url}
                alt=""
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

function StickerRow({ tabs, seeAll, stickers, show }: AllProps) {
  return (
    <Section title={tabs.stickers} seeAll={seeAll} onSeeAll={() => show("stickers")}>
      <div className="grid grid-cols-4 gap-1.5">
        {stickers.stickers.slice(0, ALL_STICKERS).map((sticker) => (
          <button
            key={sticker.name}
            type="button"
            aria-label={sticker.label}
            onClick={() => stickers.onPick(sticker.name)}
            className={TILE}
          >
            <Sticker name={sticker.name} text={sticker.text} label={sticker.label} size="sm" />
          </button>
        ))}
      </div>
    </Section>
  );
}

function AllTab(props: AllProps) {
  const { searchLabel, gifs } = props;
  return (
    <div className="flex flex-col gap-4">
      {gifs?.notice ? <GifNotice notice={gifs.notice} /> : null}
      {gifs ? (
        <Input
          id="expression-search"
          icon="search"
          type="search"
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={gifs.query}
          onChange={(event) => gifs.onQuery(event.target.value)}
        />
      ) : null}
      <EmojiRow {...props} />
      {gifs ? <GifRow {...props} gifs={gifs} /> : null}
      <StickerRow {...props} />
      {gifs ? <span className="text-[11px] text-ink-muted">{gifs.labels.attribution}</span> : null}
    </div>
  );
}

function TabBar({
  tabs,
  value,
  onChange,
  available,
}: {
  tabs: Record<ExpressionTab, string>;
  value: ExpressionTab;
  onChange: (tab: ExpressionTab) => void;
  available: ExpressionTab[];
}) {
  const itemProps = useRadioGroup(available, value, onChange);
  return (
    <div role="tablist" className="flex gap-1 border-b border-line px-2">
      {available.map((tab, index) => {
        const item = itemProps(tab, index);
        const selected = item["aria-checked"];
        return (
          <button
            key={tab}
            type="button"
            {...item}
            role="tab"
            aria-checked={undefined}
            aria-selected={selected}
            className={cx(
              "-mb-px cursor-pointer border-0 border-b-3 bg-transparent px-3 py-2.5 text-[14px]",
              selected ? "border-accent font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink",
              FOCUS_RING,
            )}
          >
            {tabs[tab]}
          </button>
        );
      })}
    </div>
  );
}

/** Escape pressed inside the popup closes it, and only it (not a reply being written). */
function useEscapeInside(frame: RefObject<HTMLDivElement | null>, onClose: () => void) {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    const element = frame.current;
    if (!element) return undefined;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      latest.current();
    };
    element.addEventListener("keydown", onKey);
    return () => element.removeEventListener("keydown", onKey);
  }, [frame]);
}

export function ExpressionPicker(props: ExpressionPickerProps) {
  const { label, tabs, emoji, gifs, stickers, onClose } = props;
  const [tab, setTab] = useState<ExpressionTab>("all");
  const available: ExpressionTab[] = gifs ? ["all", "emoji", "gifs", "stickers"] : ["all", "emoji", "stickers"];
  const frame = useRef<HTMLDivElement>(null);
  useEscapeInside(frame, onClose);
  // Opening moves the focus to the chosen tab, so the keyboard starts inside the popup (as in Teams).
  useEffect(() => {
    frame.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
  }, []);
  return (
    <div
      ref={frame}
      role="dialog"
      aria-label={label}
      className="flex max-h-[min(460px,70dvh)] w-full flex-col overflow-hidden rounded-lg border border-line bg-surface-raised text-ink shadow-2 transition-opacity duration-150 starting:opacity-0 motion-reduce:transition-none"
    >
      <TabBar tabs={tabs} value={tab} onChange={setTab} available={available} />
      <div role="tabpanel" aria-label={tabs[tab]} className="min-h-0 flex-1 overflow-y-auto p-3 [&>*]:shadow-none">
        {tab === "all" ? <AllTab {...props} show={setTab} /> : null}
        {tab === "emoji" ? <EmojiPicker {...emoji} /> : null}
        {tab === "gifs" && gifs ? <GifPicker {...gifs} /> : null}
        {tab === "stickers" ? <StickerPicker {...stickers} /> : null}
      </div>
    </div>
  );
}
