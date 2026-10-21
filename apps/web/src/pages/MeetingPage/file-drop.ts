// Files dragged over the meeting window (F03 AC-F03-29, TC-F03-93): while files are over the window the
// chat opens and shows its drop area; dropping hands the files to the message box. The browser never
// opens a dropped file itself. Guests (who can't send files) get nothing.
import { trackDrag } from "@meetapp/ui";
import { useEffect, useRef, useState } from "react";

const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;

export function useFileDrop(enabled: boolean, onDrop: (files: File[]) => void, onEnter: () => void): boolean {
  const [over, setOver] = useState(false);
  // The newest callbacks, so the window listeners are set once and the drag count isn't reset.
  const handlers = useRef({ onDrop, onEnter });
  useEffect(() => {
    handlers.current = { onDrop, onEnter };
  });
  useEffect(() => {
    if (!enabled) return;
    const drag = trackDrag();
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (!drag.enter(true)) return;
      setOver(true);
      handlers.current.onEnter();
    };
    const leave = (event: DragEvent) => {
      if (hasFiles(event)) setOver(drag.leave());
    };
    // Needed so the window accepts the drop instead of opening the file.
    const overWindow = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setOver(drag.drop());
      handlers.current.onDrop([...(event.dataTransfer?.files ?? [])]);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", overWindow);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", overWindow);
      window.removeEventListener("drop", drop);
    };
  }, [enabled]);
  return over;
}
