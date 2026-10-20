// Which files may be shared in chat, judged by their content and never by their name (F03 design.md
// section 6; S12; AC-F03-28, 30, 32). Pictures are re-saved by sharp, which turns them the right way
// up and leaves location, camera and other hidden details behind; previews are made at the same time.
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Against "decompression bomb" pictures: tiny on disk, huge in memory. */
const MAX_PIXELS = 40_000_000;
const MAX_FRAMES = 300;
const PREVIEW_WIDTH = 480;
const MAX_NAME = 200;

const PICTURES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const DOCUMENTS = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const TEXT_TYPE = "text/plain; charset=utf-8";
/** Control characters other than tab, line feed and carriage return. */
// eslint-disable-next-line no-control-regex -- finding control characters is the point
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
/** Web page or drawing code: refused even in a .txt file. */
const MARKUP = /<\s*(html|svg|script|iframe|object|body|head|!doctype)\b/i;
/** The name of the macro part inside an Office file: such files are refused (D059 owner's choice). */
const MACROS = new TextEncoder().encode("vbaProject.bin");

export class FileRefusedError extends Error {
  readonly reason: "type" | "size";
  constructor(reason: "type" | "size") {
    super(reason === "size" ? "Files can be up to 25 MB" : "This kind of file can't be sent");
    this.name = "FileRefusedError";
    this.reason = reason;
  }
}

export interface CheckedFile {
  bytes: Uint8Array;
  mediaType: string;
  preview?: Uint8Array;
  width?: number;
  height?: number;
}

/** The shown name: no folders, no control characters, at most 200 characters. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex -- removing control characters is the point
  const clean = base.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return (clean || "file").slice(0, MAX_NAME);
}

function contains(bytes: Uint8Array, needle: Uint8Array): boolean {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).includes(Buffer.from(needle));
}

function asText(bytes: Uint8Array, name: string): CheckedFile | undefined {
  if (!/\.(txt|csv)$/i.test(name)) return undefined;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
  if (CONTROL.test(text) || MARKUP.test(text)) return undefined;
  return { bytes, mediaType: TEXT_TYPE };
}

async function asPicture(bytes: Uint8Array, mediaType: string): Promise<CheckedFile> {
  try {
    const animated = mediaType === "image/gif" || mediaType === "image/webp";
    const input = () => sharp(bytes, { limitInputPixels: MAX_PIXELS, animated });
    const meta = await input().metadata();
    if ((meta.pages ?? 1) > MAX_FRAMES) throw new FileRefusedError("type");
    // .rotate() turns the picture the right way up; sharp keeps no metadata unless asked to.
    const cleaned = await input()
      .rotate()
      .toFormat(meta.format ?? "png")
      .toBuffer({ resolveWithObject: true });
    const preview = await sharp(cleaned.data, { limitInputPixels: MAX_PIXELS })
      .resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return {
      bytes: new Uint8Array(cleaned.data),
      mediaType,
      preview: new Uint8Array(preview),
      width: cleaned.info.width,
      height: cleaned.info.pageHeight ?? cleaned.info.height,
    };
  } catch {
    throw new FileRefusedError("type");
  }
}

/** The file as it will be stored, or FileRefusedError (AC-F03-30): nothing is kept for refused files. */
export async function checkFile(bytes: Uint8Array, name: string): Promise<CheckedFile> {
  if (bytes.length > MAX_FILE_BYTES) throw new FileRefusedError("size");
  if (bytes.length === 0) throw new FileRefusedError("type");
  const found = await fileTypeFromBuffer(bytes);
  if (!found) {
    const text = asText(bytes, name);
    if (text) return text;
    throw new FileRefusedError("type");
  }
  if (PICTURES.has(found.mime)) return asPicture(bytes, found.mime);
  if (DOCUMENTS.has(found.mime) && !contains(bytes, MACROS)) return { bytes, mediaType: found.mime };
  throw new FileRefusedError("type");
}
