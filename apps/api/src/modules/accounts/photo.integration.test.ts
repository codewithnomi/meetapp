// Profile photos (TC-F01-64, 65, 66, 67; AC-F01-25, 31): judged by content, not name or type; limited to
// 5 MB and a pixel count; stored re-encoded without location or camera details; seen only by the
// person and those who share a workspace with them. Needs the `pnpm dev` services (database, storage).
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import {
  CAMERA,
  FAKES,
  PLACE_NOTE,
  decompressionBomb,
  jpegOfSize,
  jpegWithLocation,
  pngWithText,
  realImages,
} from "../../test-support/photos.ts";
import {
  caller,
  errorCode,
  newPerson,
  seedWorkspace,
  type Call,
  type Person,
} from "../../test-support/workspaces-setup.ts";
import { MAX_PHOTO_BYTES } from "./avatar-image.ts";
import { avatarStorageKey } from "./provider-photo.ts";

const SLOW = { timeout: 60_000 };
let t: AuthTestApp;
let call: Call;
beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const upload = (who: Person, body: Buffer, type = "image/png") =>
  t.app.inject({
    method: "PUT",
    url: "/api/v1/me/avatar",
    payload: body,
    headers: { origin: "app://meetapp", "content-type": type, ...bearer(who.token) },
  });
const photoUrl = async (who: Person) =>
  (await call(who.token, "GET", "/api/v1/me")).json<{ user: { photoUrl: string | null } }>().user.photoUrl;
const keyOf = (url: string) => new URL(url, "http://x").searchParams.get("v") ?? "";

describe("photo type is judged by content", () => {
  it("TC-F01-64 [AC-F01-25] real JPEG, PNG and WebP are accepted, whatever the stated type", SLOW, async () => {
    const person = await newPerson(t, "types");
    const images = await realImages();
    for (const [body, type] of [
      [images.jpeg, "image/jpeg"],
      [images.png, "image/png"],
      [images.webp, "image/webp"],
      [images.png, "text/plain"],
    ] as const) {
      const answer = await upload(person, body, type);
      expect(answer.statusCode).toBe(200);
      expect(answer.json<{ photoUrl: string }>().photoUrl).toMatch(
        new RegExp(`^/api/v1/users/${person.id}/avatar\\?v=`),
      );
    }
  });

  it(
    "TC-F01-64 [AC-F01-25] GIF, SVG, PDF, HTML, EXE, empty and garbage are refused and nothing is stored",
    SLOW,
    async () => {
      const person = await newPerson(t, "fakes");
      for (const [name, body] of Object.entries(FAKES)) {
        const answer = await upload(person, body, "image/png");
        expect(answer.statusCode, name).toBe(400);
        expect(errorCode(answer), name).toBe(name === "empty" ? errorCode(answer) : "PHOTO_INVALID");
        expect(answer.json<{ error: { message: string } }>().error.message, name).toMatch(
          /JPEG, PNG or WebP|not valid/,
        );
      }
      expect(await photoUrl(person)).toBeNull();
    },
  );
});

describe("size and pixel limits", () => {
  it("TC-F01-65 [AC-F01-25] exactly 5 MB is accepted; one byte more is refused with 413", SLOW, async () => {
    const person = await newPerson(t, "size");
    expect((await upload(person, await jpegOfSize(MAX_PHOTO_BYTES), "image/jpeg")).statusCode).toBe(200);
    const tooBig = await upload(person, await jpegOfSize(MAX_PHOTO_BYTES + 1), "image/jpeg");
    expect(tooBig.statusCode).toBe(413);
  });

  it(
    "TC-F01-65 [AC-F01-25] a decompression bomb is refused by the pixel limit without using much memory",
    SLOW,
    async () => {
      const person = await newPerson(t, "bomb");
      const before = process.memoryUsage().rss;
      const answer = await upload(person, decompressionBomb());
      expect(answer.statusCode).toBe(400);
      expect(errorCode(answer)).toBe("PHOTO_INVALID");
      expect(process.memoryUsage().rss - before).toBeLessThan(200 * 1024 * 1024);
      expect(await photoUrl(person)).toBeNull();
    },
  );
});

describe("stored photo", () => {
  it(
    "TC-F01-66 [AC-F01-25] stored as a 512×512 WebP with no EXIF, GPS, camera or text; replaced and removed cleanly",
    SLOW,
    async () => {
      const person = await newPerson(t, "clean");
      const fixture = await jpegWithLocation();
      expect((await sharp(fixture).metadata()).exif?.toString("latin1")).toContain(CAMERA);
      expect((await upload(person, fixture, "image/jpeg")).statusCode).toBe(200);
      const firstKey = keyOf((await photoUrl(person)) ?? "");
      const stored = Buffer.from(await t.storage.get(avatarStorageKey(person.id, firstKey)));
      const meta = await sharp(stored).metadata();
      expect(meta).toMatchObject({ format: "webp", width: 512, height: 512 });
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(stored.toString("latin1")).not.toContain(CAMERA);

      expect((await upload(person, await pngWithText())).statusCode).toBe(200);
      const secondKey = keyOf((await photoUrl(person)) ?? "");
      expect(Buffer.from(await t.storage.get(avatarStorageKey(person.id, secondKey))).toString("latin1")).not.toContain(
        PLACE_NOTE,
      );
      await expect(t.storage.get(avatarStorageKey(person.id, firstKey))).rejects.toThrow();

      expect((await call(person.token, "DELETE", "/api/v1/me/avatar")).statusCode).toBe(204);
      expect(await photoUrl(person)).toBeNull();
      await expect(t.storage.get(avatarStorageKey(person.id, secondKey))).rejects.toThrow();
    },
  );
});

describe("who can see a photo", () => {
  it(
    "TC-F01-67 [AC-F01-25, AC-F01-31] the person and workspace-mates see it; outsiders, signed-out and leavers get 404",
    SLOW,
    async () => {
      const [u, v, w] = await Promise.all([newPerson(t, "u"), newPerson(t, "v"), newPerson(t, "w")]);
      const workspaceId = await seedWorkspace(t, [
        [u, "owner"],
        [v, "member"],
      ]);
      expect((await upload(u, (await realImages()).png)).statusCode).toBe(200);
      const url = (await photoUrl(u)) ?? "";
      for (const viewer of [u, v]) {
        const seen = await call(viewer.token, "GET", url);
        expect(seen.statusCode).toBe(200);
        expect(seen.headers["content-type"]).toBe("image/webp");
        expect(seen.headers["cache-control"]).toBe("private, max-age=60");
      }
      const outsider = await call(w.token, "GET", url);
      const noPhoto = await call(u.token, "GET", `/api/v1/users/${w.id}/avatar`);
      const noUser = await call(u.token, "GET", `/api/v1/users/${crypto.randomUUID()}/avatar`);
      const malformed = await call(u.token, "GET", "/api/v1/users/not-an-id/avatar");
      for (const answer of [outsider, noPhoto, noUser, malformed]) {
        expect(answer.statusCode).toBe(404);
        expect(answer.json()).toMatchObject({ error: { code: "NOT_FOUND", message: "Not found." } });
      }
      expect((await t.app.inject({ method: "GET", url })).statusCode).toBe(401);
      expect((await call(v.token, "POST", `/api/v1/workspaces/${workspaceId}/leave`)).statusCode).toBe(204);
      expect((await call(v.token, "GET", url)).statusCode).toBe(404);
    },
  );
});
