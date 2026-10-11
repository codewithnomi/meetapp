// Fixture: colors come from design-token classes only (must pass).

export function TokenClass({ t }: { t: (key: string) => string }) {
  return (
    <button type="button" className="bg-accent text-text">
      {t("common.save")}
    </button>
  );
}
