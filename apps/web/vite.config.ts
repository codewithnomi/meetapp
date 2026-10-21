// The renderer: React + Tailwind (token classes only). The desktop app (T15) serves it; in development
// Vite runs on 127.0.0.1:5173. Settings come from the repository's root .env (only VITE_* reach the app).
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { defineConfig, type Plugin } from "vite";

/**
 * Development only: the dev server tags its own inline live-reload scripts with this nonce, and the
 * desktop app's development CSP allows exactly this nonce (apps/desktop/src/main/security.ts).
 */
export const DEV_CSP_NONCE = "meetapp-dev";

/** The emoji list the picker reads, bundled with the app so nothing is fetched from a CDN (F03, D058). */
const EMOJI_FILES = ["en/data.json", "en/messages.json"];

function bundledEmojiData(): Plugin {
  const require = createRequire(import.meta.url);
  const read = (file: string) => readFileSync(require.resolve(`emojibase-data/${file}`));
  return {
    name: "meetapp-emojibase",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const file = EMOJI_FILES.find((name) => request.url === `/emojibase/${name}`);
        if (!file) return next();
        response.setHeader("content-type", "application/json");
        response.end(read(file));
      });
    },
    generateBundle() {
      for (const file of EMOJI_FILES)
        this.emitFile({ type: "asset", fileName: `emojibase/${file}`, source: read(file) });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), bundledEmojiData()],
  ...(command === "serve" ? { html: { cspNonce: DEV_CSP_NONCE } } : {}),
  envDir: "../..",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
}));
