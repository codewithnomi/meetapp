// Sample data for the ExpressionPicker's stories and tests (and the ChatComposer story).
import type { ExpressionPickerProps } from "./ExpressionPicker.tsx";

const noop = () => undefined;

export const SAMPLE_EXPRESSIONS: Omit<ExpressionPickerProps, "onClose"> = {
  label: "Emoji, GIFs and stickers",
  tabs: { all: "All", emoji: "Emoji", gifs: "GIFs", stickers: "Stickers" },
  seeAll: "See all",
  searchLabel: "Find something fun",
  emoji: {
    dataUrl: "/emojibase",
    recent: ["👍", "🎉"],
    onPick: noop,
    labels: {
      search: "Search emoji",
      recent: "Recently used",
      loading: "Loading…",
      empty: "No emoji found",
      skinTone: "Skin tone",
    },
  },
  featured: ["😆", "🙂", "👍", "👏", "🎉", "❤️"].map((emoji) => ({ emoji, label: emoji })),
  gifs: {
    query: "",
    onQuery: noop,
    results: [],
    status: "unavailable",
    onPick: noop,
    reduceMotion: false,
    labels: {
      search: "Search GIFs",
      loading: "Loading GIFs",
      unavailable: "GIFs aren't available right now",
      attribution: "Powered by KLIPY",
    },
  },
  stickers: {
    label: "Stickers",
    stickers: ["thank-you", "great-job", "on-my-way", "agreed", "coffee"].map((name) => ({
      name,
      text: name,
      label: `Sticker: ${name}`,
    })),
    onPick: noop,
  },
};
