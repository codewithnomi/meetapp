// Fixture: all visible text goes through the translation function (must pass).

export function Translated({ t }: { t: (key: string) => string }) {
  return <button type="button">{t("common.save")}</button>;
}
