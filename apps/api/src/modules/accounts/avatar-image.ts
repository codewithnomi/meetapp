// Turning a picture into a profile photo (F01 design.md section 6, security rule S12): only JPEG, PNG or
// WebP, judged by the file's content and not its name; re-encoded by sharp to a 512×512 WebP with a
// pixel limit against "decompression bomb" files. Re-encoding also drops location and camera details.
import sharp from "sharp";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const SIZE = 512;

const SIGNATURES: ((bytes: Uint8Array) => boolean)[] = [
  (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff, // JPEG
  (bytes) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value), // PNG
  (bytes) =>
    Buffer.from(bytes.subarray(0, 4)).toString("latin1") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("latin1") === "WEBP", // WebP
];

class NotAPhotoError extends Error {
  constructor(reason: string) {
    super(`Not a usable photo: ${reason}`);
    this.name = "NotAPhotoError";
  }
}

/** The stored form of a photo, or NotAPhotoError when the bytes aren't one we accept. */
export async function toAvatarWebp(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes.length > MAX_PHOTO_BYTES) throw new NotAPhotoError("larger than 5 MB");
  if (!SIGNATURES.some((matches) => matches(bytes))) throw new NotAPhotoError("not JPEG, PNG or WebP");
  try {
    return await sharp(bytes, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize(SIZE, SIZE, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new NotAPhotoError("unreadable image");
  }
}
