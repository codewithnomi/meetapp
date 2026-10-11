// Fixture: a raw hsl() color in a style object (must fail meetapp/no-raw-color).

export function Hsl() {
  return <div style={{ color: "hsl(200 50% 50%)" }} />;
}
