// Test pictures for the photo tests (TC-F01-64, 65, 66): real JPEG/PNG/WebP files, a JPEG with location
// and camera details, a PNG with a text note, a "decompression bomb" (a tiny PNG that claims 30000 ×
// 30000 pixels) and files that only pretend to be images.
import { crc32, deflateSync } from "node:zlib";
import sharp from "sharp";

const square = () => sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 51, g: 170, b: 119 } } });

export const CAMERA = "SecretCam 9000";
export const PLACE_NOTE = "Home of Test Person";

export async function realImages() {
  return {
    jpeg: await square().jpeg().toBuffer(),
    png: await square().png().toBuffer(),
    webp: await square().webp().toBuffer(),
  };
}

/** A JPEG carrying a camera model and GPS position in its EXIF details. */
export function jpegWithLocation(): Promise<Buffer> {
  return square()
    .jpeg()
    .withExif({
      IFD0: { Make: "SecretCam", Model: CAMERA },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "0/1 7/1 0/1" },
    })
    .toBuffer();
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** A real PNG with a tEXt note inserted after its header chunk. */
export async function pngWithText(): Promise<Buffer> {
  const png = await square().png().toBuffer();
  const afterHeader = 8 + 25;
  const note = chunk("tEXt", Buffer.from(`Comment\0${PLACE_NOTE}`, "latin1"));
  return Buffer.concat([png.subarray(0, afterHeader), note, png.subarray(afterHeader)]);
}

/** A few hundred bytes that claim 30000 × 30000 grey pixels. */
export function decompressionBomb(): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(30_000, 0);
  header.writeUInt32BE(30_000, 4);
  header.set([8, 0, 0, 0, 0], 8); // 8-bit grey, no interlace
  const rows = deflateSync(Buffer.alloc(30_001 * 4));
  return Buffer.concat([PNG_SIGNATURE, chunk("IHDR", header), chunk("IDAT", rows), chunk("IEND", Buffer.alloc(0))]);
}

/** A real JPEG padded with zeros after its end to exactly `size` bytes. */
export async function jpegOfSize(size: number): Promise<Buffer> {
  const jpeg = await square().jpeg().toBuffer();
  return Buffer.concat([jpeg, Buffer.alloc(size - jpeg.length)]);
}

/** Files that are not JPEG, PNG or WebP, whatever they are called. */
export const FAKES: Record<string, Buffer> = {
  gif: Buffer.from(
    "GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x00\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;",
    "latin1",
  ),
  svg: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
  pdf: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"),
  html: Buffer.from("<!doctype html><script>alert(1)</script>"),
  exe: Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "latin1"),
  empty: Buffer.alloc(0),
  /** A PNG header followed by garbage. */
  garbage: Buffer.concat([PNG_SIGNATURE, Buffer.from("this is not image data at all".repeat(20))]),
};
