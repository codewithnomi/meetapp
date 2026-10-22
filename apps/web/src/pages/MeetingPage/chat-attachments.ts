// Files waiting in the message box (F03 design.md section 6; AC-F03-28–30, 34): chosen, dropped or
// pasted files are checked quickly here (size, kind by name) for fast messages, uploaded with progress,
// and sent with the next message. The server checks every file again by its content.
import { useState } from "react";
import { uploadFile, type UploadProblem } from "../../features/meetings/chat/index.ts";
import type { ChatPlace } from "../../features/meetings/chat/index.ts";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED = /\.(png|jpe?g|gif|webp|pdf|txt|csv|docx|xlsx|pptx)$/i;
const MAX_PER_MESSAGE = 10;

export interface Waiting {
  key: string;
  file: File;
  state: "uploading" | "ready" | "failed";
  percent: number;
  uploadedId?: string | undefined;
  problem?: UploadProblem | undefined;
}

/** Why a file is refused before uploading, or undefined when it may go up. */
export function quickCheck(file: File): "CHAT_FILE_TOO_BIG" | "CHAT_FILE_TYPE" | undefined {
  if (file.size > MAX_FILE_BYTES) return "CHAT_FILE_TOO_BIG";
  if (!ALLOWED.test(file.name)) return "CHAT_FILE_TYPE";
  return undefined;
}

export function useAttachments(place: ChatPlace) {
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const [refused, setRefused] = useState<{ name: string; problem: UploadProblem }>();
  const change = (key: string, update: Partial<Waiting>) =>
    setWaiting((list) => list.map((item) => (item.key === key ? { ...item, ...update } : item)));
  const start = (item: Waiting) =>
    void uploadFile(place, item.file, (percent) => change(item.key, { percent })).then(
      (uploaded) => change(item.key, { state: "ready", uploadedId: uploaded.id, percent: 100 }),
      (problem: UploadProblem) => {
        if (problem === "failed") change(item.key, { state: "failed" });
        else {
          setWaiting((list) => list.filter((other) => other.key !== item.key));
          setRefused({ name: item.file.name, problem });
        }
      },
    );
  const add = (files: File[]) => {
    const room = MAX_PER_MESSAGE - waiting.length;
    for (const file of files.slice(0, Math.max(0, room))) {
      const problem = quickCheck(file);
      if (problem) {
        setRefused({ name: file.name, problem });
        continue;
      }
      const item: Waiting = { key: crypto.randomUUID(), file, state: "uploading", percent: 0 };
      setWaiting((list) => [...list, item]);
      start(item);
    }
  };
  return {
    waiting,
    refused,
    clearRefused: () => setRefused(undefined),
    add,
    retry: (item: Waiting) => (change(item.key, { state: "uploading", percent: 0 }), start(item)),
    remove: (key: string) => setWaiting((list) => list.filter((item) => item.key !== key)),
    readyIds: waiting.flatMap((item) => (item.state === "ready" && item.uploadedId ? [item.uploadedId] : [])),
    busy: waiting.some((item) => item.state === "uploading"),
    clear: () => setWaiting([]),
  };
}

export type Attachments = ReturnType<typeof useAttachments>;
