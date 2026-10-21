// File uploads arrive as the raw file in the body, its name in `x-file-name` (F03 design.md 6; used by
// meeting chat and F14 chats).
import type { FastifyInstance } from "fastify";
import { MAX_FILE_BYTES } from "./chat-files.service.ts";

/** One byte over the limit still reaches the checker, which answers CHAT_FILE_TOO_BIG. */
export const BODY_LIMIT = MAX_FILE_BYTES + 1;

/** Inside an upload-only plugin: every body is kept as raw bytes. */
export function rawBodies(app: FastifyInstance) {
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", { parseAs: "buffer", bodyLimit: BODY_LIMIT }, (_request, body, done) => {
    done(null, body);
  });
}

export function fileNameOf(header: unknown): string {
  if (typeof header !== "string") return "file";
  try {
    return decodeURIComponent(header);
  } catch {
    return "file";
  }
}
