// Fixture: "#" values that are not colors: a link anchor and a room number (must pass).

export function NotColors({ t }: { t: (key: string) => string }) {
  return (
    <a href={"#abc"} data-room="#101">
      {t("common.open")}
    </a>
  );
}
