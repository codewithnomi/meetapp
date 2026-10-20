// "Choose what to share" (approved canvas, AC-F02-25): whole screen or one window, with previews; the
// note that everyone will see it, that it replaces someone else's share and that computer sound isn't
// shared. When macOS doesn't allow screen recording, the way to allow it shows instead.
import { SharePicker, type ShareKind } from "@meetapp/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { screenBlocked, shareSources, type ShareSource } from "../../features/meetings/index.ts";

export interface ShareDialogProps {
  onShare: (sourceId: string) => void;
  onClose: () => void;
}

function useSources() {
  const [sources, setSources] = useState<ShareSource[]>();
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    let live = true;
    void screenBlocked()
      .then(async (isBlocked) => {
        if (!live) return;
        setBlocked(isBlocked);
        if (!isBlocked) {
          const list = await shareSources();
          if (live) setSources(list);
        }
      })
      // If the computer can't list its screens, the picker says none were found instead of waiting forever.
      .catch(() => live && setSources([]));
    return () => {
      live = false;
    };
  }, []);
  return { sources, blocked };
}

export function ShareDialog({ onShare, onClose }: ShareDialogProps) {
  const { t } = useTranslation();
  const { sources, blocked } = useSources();
  const [kind, setKind] = useState<ShareKind>("screen");
  const [selected, setSelected] = useState<string>();
  const shown = (sources ?? []).filter((source) => source.kind === kind);
  return (
    <SharePicker
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("meetings.share.title")}
      closeLabel={t("meetings.share.close")}
      note={t("meetings.share.note")}
      kind={{
        label: t("meetings.share.kind"),
        value: kind,
        options: [
          { value: "screen", label: t("meetings.share.screen") },
          { value: "window", label: t("meetings.share.window") },
        ],
        onChange: (next) => (setKind(next), setSelected(undefined)),
      }}
      sourcesLabel={kind === "screen" ? t("meetings.share.screens") : t("meetings.share.windows")}
      sources={shown}
      selectedId={selected}
      onSelect={setSelected}
      loadingLabel={sources === undefined && !blocked ? t("meetings.share.finding") : undefined}
      emptyText={t("meetings.share.none")}
      blocked={
        blocked
          ? {
              icon: "screen",
              tone: "warning",
              title: t("meetings.share.blockedTitle"),
              body: t("meetings.share.blockedBody"),
            }
          : undefined
      }
      cancelLabel={t("meetings.share.cancel")}
      share={{ label: t("meetings.share.share"), onClick: () => selected && onShare(selected) }}
    />
  );
}
