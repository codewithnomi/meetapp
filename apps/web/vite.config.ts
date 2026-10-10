// The renderer: React + Tailwind (token classes only). The desktop app (T15) serves it; in development
// Vite runs on 127.0.0.1:5173. Settings come from the repository's root .env (only VITE_* reach the app).
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Development only: the dev server tags its own inline live-reload scripts with this nonce, and the
 * desktop app's development CSP allows exactly this nonce (apps/desktop/src/main/security.ts).
 */
export const DEV_CSP_NONCE = "meetapp-dev";

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  ...(command === "serve" ? { html: { cspNonce: DEV_CSP_NONCE } } : {}),
  envDir: "../..",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
}));
