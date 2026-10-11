// Builds the desktop app's own code with Vite 8 (D039): the main process as an ES module and the
// preload as CommonJS (sandboxed preloads must be CommonJS). The screens come from apps/web.
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
// Electron, Node's own modules and installed packages are loaded at run time, never bundled.
const external = ["electron", /^node:/, ...builtinModules, /^@sentry\//];

async function buildEntry(entry: string, outDir: string, format: "es" | "cjs", fileName: string): Promise<void> {
  await build({
    root,
    configFile: false,
    logLevel: "warn",
    build: {
      outDir,
      emptyOutDir: true,
      target: "node24",
      ssr: entry,
      rolldownOptions: { external, output: { format, entryFileNames: fileName } },
    },
  });
}

export async function buildDesktop(): Promise<void> {
  await buildEntry("src/main/main.ts", "out/main", "es", "main.js");
  await buildEntry("src/preload/preload.ts", "out/preload", "cjs", "preload.cjs");
}

if (import.meta.main) await buildDesktop();
