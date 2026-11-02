// Choosing a background (AC-F15-30): None, Blur and the 8 pictures, the same in Settings → Devices, the
// pre-join screen and the in-call device settings. On a computer that can't run effects the choices are
// off and say so (TC-F15-51); calls still work with the plain camera.
import { BackgroundPicker, type BackgroundOption } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { PICTURES, backgroundsSupported, pictureUrl } from "./backgrounds.ts";
import { useBackgroundSlow } from "./background-state.ts";

export function BackgroundChoice({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const clear = useBackgroundSlow((state) => state.clear);
  const options: BackgroundOption[] = [
    { id: "none", name: t("devices.backgrounds.none"), kind: "none" },
    { id: "blur", name: t("devices.backgrounds.blur"), kind: "blur" },
    ...PICTURES.map((id) => ({
      id,
      name: t(`devices.backgrounds.pictures.${id}`),
      kind: "picture" as const,
      imageUrl: pictureUrl(id),
    })),
  ];
  return (
    <BackgroundPicker
      legend={t("devices.backgrounds.legend")}
      options={options}
      value={value}
      onChange={(id) => (clear(), onChange(id))}
      hint={t("devices.backgrounds.hint")}
      unavailable={backgroundsSupported() ? undefined : t("devices.backgrounds.unavailable")}
    />
  );
}
