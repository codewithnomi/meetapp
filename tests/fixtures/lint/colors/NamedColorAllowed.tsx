// Fixture: currentColor, transparent and inherit are not fixed colors, and "red" in a non-color
// attribute is just a word (must pass).

export function NamedColorAllowed() {
  return (
    <svg viewBox="0 0 24 24" style={{ color: "inherit", backgroundColor: "transparent" }} data-kind="red">
      <path fill="currentColor" stroke="transparent" d="M0 0h24v24H0z" />
    </svg>
  );
}
