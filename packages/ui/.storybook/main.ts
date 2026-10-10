// Storybook: the component gallery (AC-F00-13). Run with `pnpm storybook` (127.0.0.1:6006 only).
import tailwindcss from "@tailwindcss/vite";
import { defineMain } from "@storybook/react-vite/node";

export default defineMain({
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y", "storybook-addon-pseudo-states"],
  core: { disableTelemetry: true },
  async viteFinal(config) {
    return { ...config, plugins: [...(config.plugins ?? []), tailwindcss()] };
  },
});
