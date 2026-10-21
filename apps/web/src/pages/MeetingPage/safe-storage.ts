// This computer's storage for small conveniences (the GIF notice seen, recent emoji). It can be missing
// or refuse (private windows, blocked site data): reads then give nothing and writes are skipped, so the
// chat still works for this session.
export function readSaved(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

export function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not saved: kept for this session only.
  }
}
