// Fixture: a raw rgb() color in a style object (must fail meetapp/no-raw-color).

export function Rgb() {
  return <div style={{ borderColor: "rgb(0,0,0)" }} />;
}
