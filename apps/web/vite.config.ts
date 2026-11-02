// The renderer: React + Tailwind (token classes only). The desktop app (T15) serves it; in development
// Vite runs on 127.0.0.1:5173. Settings come from the repository's root .env (only VITE_* reach the app).
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
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

/**
 * The background tool's engine (F15, D073): MediaPipe's WebAssembly files, served from the app itself
 * (`/backgrounds/wasm/…`) so nothing is downloaded from a CDN. Taken from the installed package, so they
 * always match its version; the model and pictures are in public/backgrounds.
 */
const WASM_FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

function bundledBackgroundEngine(): Plugin {
  const fromProcessors = createRequire(createRequire(import.meta.url).resolve("@livekit/track-processors"));
  const folder = dirname(fromProcessors.resolve("@mediapipe/tasks-vision"));
  const read = (file: string) => readFileSync(join(folder, "wasm", file));
  const type = (file: string) => (file.endsWith(".wasm") ? "application/wasm" : "text/javascript");
  return {
    name: "meetapp-background-engine",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const file = WASM_FILES.find((name) => request.url === `/backgrounds/wasm/${name}`);
        if (!file) return next();
        response.setHeader("content-type", type(file));
        response.end(read(file));
      });
    },
    generateBundle() {
      for (const file of WASM_FILES)
        this.emitFile({ type: "asset", fileName: `backgrounds/wasm/${file}`, source: read(file) });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), bundledEmojiData(), bundledBackgroundEngine()],
  ...(command === "serve" ? { html: { cspNonce: DEV_CSP_NONCE } } : {}),
  envDir: "../..",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
}));
