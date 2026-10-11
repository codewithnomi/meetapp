// Fixture: a CSS named color in an SVG fill attribute (must fail meetapp/no-raw-color).

export function NamedColorAttribute() {
  return (
    <svg viewBox="0 0 24 24">
      <path fill="white" d="M0 0h24v24H0z" />
    </svg>
  );
}
