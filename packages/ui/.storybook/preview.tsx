// Every story renders inside the real theme: the toolbar switches light/dark and the 8 accents by
// setting data-theme / data-accent on <html>, exactly as the app does.
import type { Decorator, Preview } from "@storybook/react-vite";
import { ACCENTS } from "@meetapp/design-tokens";
import "../src/styles.css";

const withTheme: Decorator = (Story, context) => {
  const root = document.documentElement;
  root.dataset["theme"] = String(context.globals["theme"] ?? "light");
  const accent = String(context.globals["accent"] ?? "sky");
  if (accent === "sky") delete root.dataset["accent"];
  else root.dataset["accent"] = accent;
  return (
    <div className="bg-bg p-6 text-ink">
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: "Light or dark theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
    accent: {
      description: "Accent color",
      toolbar: {
        title: "Accent",
        icon: "paintbrush",
        items: ACCENTS.map((value) => ({ value, title: value })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light", accent: "sky" },
  parameters: {
    layout: "fullscreen",
    backgrounds: { disable: true },
    // Any accessibility violation fails the story check (AC-F00-14).
    a11y: { test: "error" },
  },
};

export default preview;
