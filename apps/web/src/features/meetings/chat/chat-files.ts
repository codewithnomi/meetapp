// Files and GIFs in the meeting chat (F03 design.md sections 6 and 7). Uploads send the file itself
// with its name in X-File-Name and report progress; downloads ask for a 5-minute link and save it with
// "Save as" in the desktop app; GIFs are searched at KLIPY by the app itself, as KLIPY requires (D059).
import { apiFileUrl, apiRequest } from "../../api/index.ts";
import type { Joined } from "../visit.ts";
import type { ChatPlace } from "./chat-api.ts";

const base = (visit: Joined) => `/api/v1/calls/${visit.call?.callId ?? ""}/chat`;

/** What the server says about an upload (TC-F03-52), or "failed" when it couldn't be reached. */
export type UploadProblem =
  "CHAT_FILE_TOO_BIG" | "CHAT_FILE_TYPE" | "CHAT_FILE_RATE" | "CHAT_MEETING_FILES_FULL" | "CHAT_OFF" | "failed";

export interface Uploaded {
  id: string;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
}

function readJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Uploads one file, reporting progress (0–100); rejects with an UploadProblem. */
export function uploadFile(visit: Joined, file: File, onProgress: (percent: number) => void): Promise<Uploaded> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", apiFileUrl(`${base(visit)}/attachments`) ?? "");
    request.setRequestHeader("content-type", "application/octet-stream");
    request.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    request.setRequestHeader("x-meeting-ticket", visit.ticket);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      const answer = readJson(request.responseText);
      if (request.status === 200 && answer) return resolve(answer as Uploaded);
      // A refusal names its reason; anything else (including a broken answer) is "failed".
      const code = (answer as { error?: { code?: UploadProblem } } | undefined)?.error?.code;
      reject(request.status !== 200 && code ? code : "failed");
    };
    request.onerror = () => reject("failed");
    request.send(file);
  });
}

/** A 5-minute address for a sent file or its preview (AC-F03-31). */
export async function fileAddress(place: ChatPlace, attachmentId: string, preview: boolean): Promise<string> {
  const link = await apiRequest<{ url: string }>(
    `${place.path}/attachments/${attachmentId}/link${preview ? "?preview=true" : ""}`,
    { headers: place.headers },
  );
  return apiFileUrl(link.url) ?? "";
}

interface FilesBridge {
  meetapp?: { files?: { save: (url: string) => Promise<boolean> } };
}

/** Saves a file with "Save as" in the desktop app; a browser downloads it (it is always an attachment). */
export async function saveFile(place: ChatPlace, attachmentId: string): Promise<void> {
  const url = await fileAddress(place, attachmentId, false);
  const bridge = (window as FilesBridge).meetapp?.files;
  if (bridge) await bridge.save(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

export interface GifSettings {
  available: boolean;
  apiUrl: string;
  key: string;
  customerId: string;
}

export function gifSettings(visit: Joined): Promise<GifSettings> {
  return apiRequest(`${base(visit)}/gif-settings`, { headers: { "x-meeting-ticket": visit.ticket } });
}

export interface FoundGif {
  id: string;
  url: string;
  stillUrl?: string | undefined;
  description: string;
  width: number;
  height: number;
}

interface KlipyFile {
  url?: string;
  width?: number;
  height?: number;
}
interface KlipyItem {
  id?: string | number;
  slug?: string;
  title?: string;
  file?: Record<string, { gif?: KlipyFile; jpg?: KlipyFile; webp?: KlipyFile } | undefined>;
}

const IMAGE_HOST = "https://static.klipy.com/";

/** KLIPY's answer turned into GIFs we can show; only pictures from KLIPY's image server are kept. */
export function readKlipy(answer: unknown): FoundGif[] {
  const found = (answer as { data?: { data?: unknown } } | null)?.data?.data;
  const items: KlipyItem[] = Array.isArray(found) ? (found as KlipyItem[]) : [];
  return items.flatMap((item) => {
    const size = item.file?.["sm"] ?? item.file?.["md"] ?? item.file?.["hd"];
    const gif = size?.gif;
    if (!gif?.url?.startsWith(IMAGE_HOST) || !gif.width || !gif.height) return [];
    const jpg = size?.jpg?.url;
    const still = jpg?.startsWith(IMAGE_HOST) ? jpg : undefined;
    return [
      {
        id: String(item.id ?? item.slug ?? gif.url),
        url: gif.url,
        stillUrl: still,
        description: item.title ?? "GIF",
        width: gif.width,
        height: gif.height,
      },
    ];
  });
}

/** Searches KLIPY from this app, family-safe, with no ad settings and no personal data (TC-F03-90). */
export function searchGifs(settings: GifSettings, query: string, signal: AbortSignal): Promise<FoundGif[]> {
  return askKlipy(settings, "search", { q: query }, signal);
}

/** What's trending, shown before anything is typed (as in Teams). */
export function trendingGifs(settings: GifSettings, signal: AbortSignal): Promise<FoundGif[]> {
  return askKlipy(settings, "trending", {}, signal);
}

async function askKlipy(
  settings: GifSettings,
  kind: "search" | "trending",
  extra: Record<string, string>,
  signal: AbortSignal,
): Promise<FoundGif[]> {
  const params = new URLSearchParams({
    ...extra,
    customer_id: settings.customerId,
    locale: "en",
    per_page: "24",
    content_filter: "high",
  });
  const answer = await fetch(
    `${settings.apiUrl}/api/v1/${encodeURIComponent(settings.key)}/gifs/${kind}?${params.toString()}`,
    {
      signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    },
  );
  if (!answer.ok) throw new Error("GIF search failed");
  return readKlipy(await answer.json());
}
