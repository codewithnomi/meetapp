// Files and pictures in meeting chat (F03 design.md section 6; AC-F03-28–34). An upload is checked by
// its content and cleaned before anything is stored; downloads go through our backend with a signed
// link that works for 5 minutes, so every answer carries the safe headers.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { ChatAttachment } from "./chat-files.repository.ts";
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES } from "../../plugins/rate-limit.ts";
import { notFound } from "../calls/admission.ts";
import { chatActor, type ChatDeps } from "./chat-access.ts";
import { meetingSeat, type ChatSeat } from "./chat-seat.ts";
import { FileRefusedError, checkFile, cleanFileName } from "./chat-files.ts";

export { MAX_FILE_BYTES } from "./chat-files.ts";

/** Private file storage (S3: RustFS now, R2 later). */
export interface FileStorage {
  put: (key: string, body: Uint8Array, contentType: string) => Promise<void>;
  get: (key: string) => Promise<Uint8Array>;
  delete: (key: string) => Promise<void>;
}

/** How long a download link works (AC-F03-31). */
export const LINK_SECONDS = 5 * 60;
const PREVIEW_TYPE = "image/webp";

function refusal(error: FileRefusedError): AppError {
  return error.reason === "size"
    ? new AppError(413, "CHAT_FILE_TOO_BIG", "Files can be up to 25 MB.")
    : new AppError(400, "CHAT_FILE_TYPE", "This kind of file can't be sent.");
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/** `<id>.<p|f>.<end time>.<signature>`: which file, the preview or the file, and until when. */
function fileToken(secret: string, attachmentId: string, preview: boolean, expiresAt: number): string {
  const body = `${attachmentId}.${preview ? "p" : "f"}.${String(expiresAt)}`;
  return `${body}.${sign(secret, body)}`;
}

/** The file a token names, or undefined when it was changed or its 5 minutes passed. */
function readFileToken(secret: string, token: string, now: number) {
  const [id, kind, end, signature] = token.split(".");
  if (!id || !kind || !end || !signature) return undefined;
  const expected = Buffer.from(sign(secret, `${id}.${kind}.${end}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
  if (Number(end) < now) return undefined;
  return { attachmentId: id, preview: kind === "p" };
}

/** Checks, cleans and stores a file for this seat's next message (AC-F03-28–34, F14 AC-19). */
export async function uploadAs(deps: ChatDeps, storage: FileStorage, seat: ChatSeat, file: NewFile) {
  if (!(await seat.mayAttach())) throw notFound();
  // Per person, not per ticket: leaving and rejoining doesn't give 10 more (F03 verification).
  const wait = await deps.calls.limiter.take(RATE_RULES.chatUploads, seat.limitKey);
  if (wait !== undefined) throw new AppError(429, "CHAT_FILE_RATE", "You can send up to 10 files a minute.", wait);
  const fileName = cleanFileName(file.fileName);
  const checked = await checkFile(file.bytes, fileName).catch((error: unknown) => {
    throw error instanceof FileRefusedError ? refusal(error) : error;
  });
  const id = randomUUID();
  const storageKey = `chat/${seat.workspaceId}/${seat.conversationId}/${id}`;
  const reserved = await deps.files.reserve(
    {
      id,
      workspaceId: seat.workspaceId,
      meetingId: seat.meetingId,
      conversationId: seat.conversationId,
      uploaderAttendanceId: seat.who.attendanceId,
      uploaderUserId: seat.who.userId,
      fileName,
      mediaType: checked.mediaType,
      sizeBytes: checked.bytes.length,
      storageKey,
    },
    seat.maxChatFileBytes,
  );
  if (reserved === "full") {
    throw new AppError(409, "CHAT_MEETING_FILES_FULL", "This chat has reached its file limit.");
  }
  try {
    await storage.put(storageKey, checked.bytes, checked.mediaType);
    if (checked.preview) await storage.put(`${storageKey}.preview`, checked.preview, PREVIEW_TYPE);
    await deps.files.ready(id, {
      ...(checked.preview ? { previewKey: `${storageKey}.preview` } : {}),
      width: checked.width ?? null,
      height: checked.height ?? null,
    });
  } catch (error) {
    // A half-done upload leaves nothing behind (AC-F03-05).
    await storage.delete(storageKey).catch(() => undefined);
    await deps.files.forget(id);
    throw error;
  }
  return { id, fileName, mediaType: checked.mediaType, sizeBytes: checked.bytes.length };
}

export interface NewFile {
  fileName: string;
  bytes: Uint8Array;
}

export interface UploadRequest extends NewFile {
  callId: string;
  ticketHash: string;
}

/** What the download route sends back. */
export interface FileAnswer {
  bytes: Uint8Array;
  mediaType: string;
  fileName: string;
}

/** A 5-minute link to a sent file of this meeting; the caller checked the person's rights (AC-F03-31). */
export async function linkTo(deps: ChatDeps, conversationId: string, attachmentId: string, preview: boolean) {
  const file = await deps.files.byId(conversationId, attachmentId);
  if (!file || file.status !== "ready" || !file.messageId || (preview && !file.previewKey)) throw notFound();
  const expiresAt = deps.calls.now().getTime() + LINK_SECONDS * 1000;
  const token = fileToken(deps.fileLinkSecret, file.id, preview, expiresAt);
  return { url: `/api/v1/chat-files/${token}`, expiresAt: new Date(expiresAt).toISOString() };
}

async function download(deps: ChatDeps, storage: FileStorage, token: string): Promise<FileAnswer> {
  const named = readFileToken(deps.fileLinkSecret, token, deps.calls.now().getTime());
  if (!named) throw notFound();
  const file: ChatAttachment | undefined = await deps.files.anyById(named.attachmentId);
  if (!file || file.status !== "ready") throw notFound();
  const key = named.preview ? file.previewKey : file.storageKey;
  if (!key) throw notFound();
  return {
    bytes: await storage.get(key),
    mediaType: named.preview ? PREVIEW_TYPE : file.mediaType,
    fileName: file.fileName,
  };
}

export function createChatFilesService(deps: ChatDeps, storage: FileStorage) {
  return {
    upload: async (request: UploadRequest) =>
      uploadAs(deps, storage, await meetingSeat(deps, request.callId, request.ticketHash, "attach"), request),
    /** A 5-minute link for someone allowed to see the message, never for guests (AC-F03-31, 33). */
    link: async (callId: string, ticketHash: string, attachmentId: string, preview: boolean) => {
      const { conversationId } = await chatActor(deps, callId, ticketHash, "download");
      return linkTo(deps, conversationId, attachmentId, preview);
    },
    download: (token: string) => download(deps, storage, token),
  };
}

export type ChatFilesService = ReturnType<typeof createChatFilesService>;
