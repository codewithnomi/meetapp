// Fixture: a Tailwind v4.1 text-shadow palette color is still a raw color (must fail).

export function TextShadow({ t }: { t: (key: string) => string }) {
  return <p className="text-shadow-blue-500">{t("common.title")}</p>;
}
