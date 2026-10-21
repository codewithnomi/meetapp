// Sample files for the chat file tests (F03 TC-F03-50, 52, 84, 85): real pictures made with sharp,
// small Office files built as ZIPs, and look-alikes that pretend to be something else.
import { crc32 } from "node:zlib";
import sharp from "sharp";

/** A ZIP with the given files, stored without compression (enough for type checks). */
export function zipOf(files: Record<string, string | Uint8Array>): Uint8Array {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content);
    const nameBytes = Buffer.from(name);
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    local.push(header, nameBytes, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += header.length + nameBytes.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...local, ...central, end]));
}

const CONTENT_TYPES: Record<string, [string, string]> = {
  docx: ["word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"],
  xlsx: ["xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"],
  pptx: ["ppt/presentation.xml", "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"],
  docm: ["word/document.xml", "application/vnd.ms-word.document.macroEnabled.main+xml"],
  xlsm: ["xl/workbook.xml", "application/vnd.ms-excel.sheet.macroEnabled.main+xml"],
  pptm: ["ppt/presentation.xml", "application/vnd.ms-powerpoint.slideshow.macroEnabled.main+xml"],
};

/** A minimal Office file of the given kind; `macros` adds a vbaProject.bin. */
export function officeFile(kind: keyof typeof CONTENT_TYPES, macros = false): Uint8Array {
  const [part, type] = CONTENT_TYPES[kind] ?? ["", ""];
  const types = `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/${part}" ContentType="${type}"/></Types>`;
  return zipOf({
    "[Content_Types].xml": types,
    "_rels/.rels": "<Relationships/>",
    [part]: "<doc/>",
    ...(macros ? { [`${part.split("/")[0] ?? ""}/vbaProject.bin`]: "macro" } : {}),
  });
}

export const png = (width = 8, height = 8) =>
  sharp({ create: { width, height, channels: 3, background: { r: 51, g: 170, b: 119 } } })
    .png()
    .toBuffer();
export const jpeg = () =>
  sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 170, g: 119, b: 51 } } })
    .jpeg()
    .toBuffer();
export const webp = () =>
  sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 51, g: 119, b: 170 } } })
    .webp()
    .toBuffer();
export const gif = () =>
  sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 119, g: 119, b: 119 } } })
    .gif()
    .toBuffer();

/** The start of a Windows program, the old Office container, and a tiny PDF. */
export const EXE = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, 0x03, ...new Array<number>(60).fill(0)]);
export const OLD_OFFICE = Uint8Array.from([
  0xd0,
  0xcf,
  0x11,
  0xe0,
  0xa1,
  0xb1,
  0x1a,
  0xe1,
  ...new Array<number>(504).fill(0),
]);
export const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

/** A real small PNG whose header claims 20,000 x 20,000 pixels: a "decompression bomb" look-alike. */
export async function bombPng(): Promise<Uint8Array> {
  const bytes = Buffer.from(await png());
  // IHDR starts at byte 8: length (4), "IHDR" (4), width (4), height (4), …, CRC after 13 data bytes.
  bytes.writeUInt32BE(20_000, 16);
  bytes.writeUInt32BE(20_000, 20);
  bytes.writeUInt32BE(crc32(bytes.subarray(12, 29)), 29);
  return new Uint8Array(bytes);
}

/** An animated GIF of `frames` frames. */
export async function animatedGif(frames = 3): Promise<Uint8Array> {
  // Each frame shows its own number as black and white pixels, so no two frames are alike and the
  // GIF encoder can't merge them.
  const images = await Promise.all(
    Array.from({ length: frames }, (_, n) => {
      const pixels = Buffer.alloc(8 * 8 * 3);
      for (let bit = 0; bit < 16; bit++) pixels.fill((n >> bit) & 1 ? 255 : 0, bit * 3, bit * 3 + 3);
      return sharp(pixels, { raw: { width: 8, height: 8, channels: 3 } })
        .png()
        .toBuffer();
    }),
  );
  return new Uint8Array(
    await sharp(images, { join: { animated: true } })
      .gif()
      .toBuffer(),
  );
}
