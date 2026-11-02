// Serves the built screens from app://meetapp (design.md section 5). Pages get the same origin on every
// start (so saved settings stay) and can only read files from the screens' folder.
import { readFile, realpath } from "node:fs/promises";
import { protocol, type Protocol } from "electron";
import { contentType, fileForAddress, isInside } from "./serve-files.ts";

const APP_SCHEME = "app";

/** Must run before the app is ready. "standard" and "secure" make app:// behave like https. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/** `csp` gives each page its policy (F16: the small windows' page has its own). `on` is a session's protocol. */
export function serveScreens(rendererDir: string, csp: (url: string) => string, on: Protocol = protocol): void {
  on.handle(APP_SCHEME, async (request) => {
    const file = fileForAddress(rendererDir, request.url);
    if (!file) return new Response(null, { status: 400 });
    try {
      // A shortcut (symlink) inside the folder must not lead outside it.
      if (!isInside(await realpath(rendererDir), await realpath(file))) return new Response(null, { status: 404 });
      const body = await readFile(file);
      return new Response(body, {
        headers: { "content-type": contentType(file), "content-security-policy": csp(request.url) },
      });
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
      return new Response(null, { status: missing ? 404 : 500 });
    }
  });
}
