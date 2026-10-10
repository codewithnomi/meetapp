// The renderer: React + Tailwind (token classes only). The desktop app (T15) serves it; in development
// Vite runs on 127.0.0.1:5173. Settings come from the repository's root .env (only VITE_* reach the app).
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: "../..",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
