// Whether the side menu is folded to icons (F14 AC-F14-36), kept on this computer: `meetapp.nav.folded`
// is "true" or "false"; anything else (or no storage at all) means unfolded.
import { useCallback, useState } from "react";

const KEY = "meetapp.nav.folded";

type Store = Pick<Storage, "getItem" | "setItem">;

function storage(): Store | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readFolded(store: Store | undefined = storage()): boolean {
  try {
    return store?.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function writeFolded(folded: boolean, store: Store | undefined = storage()): void {
  try {
    store?.setItem(KEY, folded ? "true" : "false");
  } catch {
    // Storage blocked: the choice lasts until the window closes.
  }
}

/** The folded state and a toggle that remembers it. */
export function useNavFolded(): [boolean, () => void] {
  const [folded, setFolded] = useState(() => readFolded());
  const toggle = useCallback(() => {
    setFolded((was) => {
      writeFolded(!was);
      return !was;
    });
  }, []);
  return [folded, toggle];
}
