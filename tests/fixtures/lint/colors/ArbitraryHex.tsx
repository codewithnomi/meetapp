// Fixture: a Tailwind arbitrary value holding a raw hex color (must fail meetapp/no-raw-color).

export function ArbitraryHex({ t }: { t: (key: string) => string }) {
  return <p className="text-[#123456]">{t("common.save")}</p>;
}
