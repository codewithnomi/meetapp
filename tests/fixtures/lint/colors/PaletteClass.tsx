// Fixture: a default Tailwind palette class instead of a token (must fail meetapp/no-raw-color).

export function PaletteClass({ t }: { t: (key: string) => string }) {
  return (
    <button type="button" className="bg-blue-500">
      {t("common.save")}
    </button>
  );
}
