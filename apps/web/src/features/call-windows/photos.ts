// Callers' photos for F16's ring windows (design.md 3.1): the small windows load nothing themselves, so
// the main window, which may reach the backend, turns each photo into a data: picture once. A photo that
// can't be read, or is bigger than 300 KB, is left out and the initials show.
import { useEffect, useState } from "react";

const MAX_BYTES = 300_000;

async function asDataUrl(url: string): Promise<string | undefined> {
  const response = await fetch(url);
  const blob = await response.blob();
  if (!response.ok || blob.size > MAX_BYTES || !blob.type.startsWith("image/")) return undefined;
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(blob);
  });
}

/** The photos read so far, by their address; each address is read once. */
export function usePhotos(urls: (string | null)[]): ReadonlyMap<string, string> {
  const [photos, setPhotos] = useState<ReadonlyMap<string, string>>(new Map());
  const wanted = urls.filter((url): url is string => Boolean(url)).join("\n");
  useEffect(() => {
    let live = true;
    for (const url of wanted.split("\n").filter(Boolean)) {
      if (photos.has(url)) continue;
      void asDataUrl(url)
        .catch(() => undefined)
        .then((data) => {
          if (live && data) setPhotos((known) => new Map(known).set(url, data));
        });
    }
    return () => {
      live = false;
    };
  }, [wanted, photos]);
  return photos;
}
