// Fixture: a screen-reader label written directly in the component (must fail i18next/no-literal-string).

export function HardcodedAriaLabel() {
  return (
    <button type="button" aria-label="Close">
      <span className="icon-close" aria-hidden />
    </button>
  );
}
