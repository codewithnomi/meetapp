// The call screen's own view: layout, page, open panel, pinned person, open dialog and a failed-action
// notice (split out of MeetingPage.tsx to keep it short).
import { useState } from "react";
import type { Panel } from "./CallControls.tsx";

export type Dialog = { kind: "share" } | { kind: "end" } | { kind: "options"; meetingId: string } | undefined;

export function useView() {
  const [layout, setLayout] = useState<"gallery" | "speaker">("gallery");
  const [page, setPage] = useState(0);
  const [panel, setPanel] = useState<Panel>();
  const [pinnedId, setPinnedId] = useState<string>();
  const [dialog, setDialog] = useState<Dialog>();
  const [failed, setFailed] = useState(false);
  return {
    layout,
    setLayout,
    page,
    setPage,
    panel,
    setPanel,
    pinnedId,
    setPinnedId,
    dialog,
    setDialog,
    failed,
    setFailed,
  };
}
