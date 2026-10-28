// Settings → Calls (F15 AC-F15-32, approved canvas "Settings: devices and calls"): the 5 ringtones, each
// with a play button, and the ringtone volume. Kept on the account, so the ringtone follows the person
// to every computer. The volume is saved a moment after the slider stops.
import { RingtonePicker, Spinner } from "@meetapp/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ApiError } from "../../features/api/index.ts";
import { ActionErrorNotice } from "../../features/auth/index.ts";
import { CALL_KEYS, RINGTONES, playRingtone, ringSettings, saveRingSettings } from "../../features/calls/index.ts";
import { SettingsShell, type SettingsScreen } from "../../features/profile/index.ts";

export interface CallsSettingsPageProps {
  onNavigate: (screen: SettingsScreen) => void;
  onBack: () => void;
}

const NAMES = ["bright", "chime", "pulse", "classic", "gentle"] as const;

const playOnce = (ringtone: number, volume: number) => {
  if (typeof AudioContext === "undefined") return;
  const stop = playRingtone(() => new AudioContext(), { ringtone, volume, repeat: false });
  setTimeout(stop, 4000);
};

function Picker({ saved }: { saved: { ringtone: number; ringVolume: number } }) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const [ringtone, setRingtone] = useState(saved.ringtone);
  const [volume, setVolume] = useState(saved.ringVolume);
  const save = useMutation<undefined, ApiError, { ringtone?: number; ringVolume?: number }>({
    mutationFn: saveRingSettings,
    onSettled: () => void queries.invalidateQueries({ queryKey: CALL_KEYS.ringSettings }),
  });
  const { mutate } = save;
  useEffect(() => {
    if (volume === saved.ringVolume) return;
    const timer = setTimeout(() => mutate({ ringVolume: volume }), 400);
    return () => clearTimeout(timer);
  }, [volume, saved.ringVolume, mutate]);
  return (
    <>
      {save.isError ? <ActionErrorNotice error={save.error} onRetry={() => save.reset()} /> : null}
      <RingtonePicker
        legend={t("settings.calls.ringtone")}
        options={RINGTONES.map((id, index) => ({
          id,
          name: t(`settings.calls.tones.${NAMES[index] ?? "bright"}`),
          hint: t(`settings.calls.hints.${NAMES[index] ?? "bright"}`),
          playLabel: t("settings.calls.play", { name: t(`settings.calls.tones.${NAMES[index] ?? "bright"}`) }),
        }))}
        value={ringtone}
        onChange={(id) => (setRingtone(id), mutate({ ringtone: id }))}
        onPlay={(id) => playOnce(id, volume)}
        volumeLabel={t("settings.calls.volume")}
        volume={volume}
        onVolume={setVolume}
      />
    </>
  );
}

export function CallsSettingsPage({ onNavigate, onBack }: CallsSettingsPageProps) {
  const { t } = useTranslation();
  const settings = useQuery<{ ringtone: number; ringVolume: number }, ApiError>({
    queryKey: CALL_KEYS.ringSettings,
    queryFn: ringSettings,
  });
  return (
    <SettingsShell screen="calls" onNavigate={onNavigate} onBack={onBack}>
      <section aria-labelledby="calls-heading" className="flex flex-col gap-5">
        <header>
          <h2 id="calls-heading" className="m-0 text-heading text-ink">
            {t("settings.calls.title")}
          </h2>
          <p className="mt-1 mb-0 text-ink-muted">{t("settings.calls.intro")}</p>
        </header>
        {settings.data ? <Picker saved={settings.data} /> : null}
        {settings.isPending ? <Spinner label={t("settings.calls.loading")} /> : null}
        {settings.isError ? <ActionErrorNotice error={settings.error} onRetry={() => void settings.refetch()} /> : null}
      </section>
    </SettingsShell>
  );
}
