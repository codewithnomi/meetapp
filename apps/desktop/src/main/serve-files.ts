// Finds the file to serve for an app:// address, and refuses anything outside the screens' folder
// (for example app://meetapp/../../secret), so a page can never read other files on the computer.
import { extname, isAbsolute, relative, resolve } from "node:path";

/** The app's only host: app://meetapp/… Any other host is refused. */
const APP_HOST = "meetapp";

/** The file inside `root` that the address points to, or undefined if it would leave `root`. */
export function fileForAddress(root: string, url: string): string | undefined {
  let pathname: string;
  try {
    const address = new URL(url);
    if (address.host !== APP_HOST) return undefined;
    pathname = decodeURIComponent(address.pathname);
  } catch {
    return undefined;
  }
  const file = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
  return isInside(root, file) ? file : undefined;
}

export function isInside(root: string, file: string): boolean {
  const inside = relative(root, file);
  return inside !== "" && !inside.startsWith("..") && !isAbsolute(inside);
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

export function contentType(file: string): string {
  return TYPES[extname(file)] ?? "application/octet-stream";
}
