// SettingsPage (page): the Appearance section of the approved Settings design — theme, accent color
// and a small preview. Choices apply to the whole app at once and are remembered (AC-F00-08, 10).
import { ACCENTS, type Accent } from "@meetapp/design-tokens";
import { AccentPicker, Badge, Button, SegmentedControl, type IconName } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { THEME_CHOICES, useAppearance, type ThemeChoice } from "../../features/appearance/index.ts";

const THEME_ICONS: Record<ThemeChoice, IconName> = { light: "sun", dark: "moon", system: "monitor" };

export interface SettingsPageProps {
  onBack: () => void;
}

/** A few accent-colored pieces, so the user sees the choice at once. The buttons do nothing. */
function AppearancePreview() {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-labelledby="appearance-preview"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <span id="appearance-preview" className="text-caption text-ink-muted">
        {t("settings.appearance.preview")}
      </span>
      <Button>{t("settings.appearance.previewPrimary")}</Button>
      <Button variant="ghost">{t("settings.appearance.previewGhost")}</Button>
      <Badge tone="accent">{t("settings.appearance.previewBadge")}</Badge>
    </div>
  );
}

function AppearanceSection() {
  const { t } = useTranslation();
  const { theme, accent, setTheme, setAccent } = useAppearance();
  const themes = THEME_CHOICES.map((value) => ({
    value,
    label: t(`settings.appearance.themes.${value}`),
    icon: THEME_ICONS[value],
  }));
  const accentNames = Object.fromEntries(
    ACCENTS.map((name) => [name, t(`settings.appearance.accents.${name}`)]),
  ) as Record<Accent, string>;

  return (
    <section aria-labelledby="appearance-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="appearance-title" className="m-0 text-heading text-ink">
          {t("settings.appearance.title")}
        </h2>
        <p className="m-0 text-body text-ink-muted">{t("settings.appearance.savedOnDevice")}</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {/* The group carries the same name for screen readers, so this visible copy is hidden from them. */}
        <span aria-hidden="true" className="text-label text-ink">
          {t("settings.appearance.theme")}
        </span>
        <SegmentedControl
          className="self-start"
          label={t("settings.appearance.theme")}
          options={themes}
          value={theme}
          onChange={setTheme}
        />
      </div>
      <div className="flex flex-col gap-2.5">
        <span aria-hidden="true" className="text-label text-ink">
          {t("settings.appearance.accent")}
        </span>
        <AccentPicker
          label={t("settings.appearance.accent")}
          labels={accentNames}
          value={accent}
          onChange={setAccent}
        />
      </div>
      <AppearancePreview />
    </section>
  );
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-10">
      <header className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          {t("settings.back")}
        </Button>
        <h1 tabIndex={-1} className="m-0 text-title text-ink outline-none">
          {t("settings.title")}
        </h1>
      </header>
      <AppearanceSection />
    </main>
  );
}
