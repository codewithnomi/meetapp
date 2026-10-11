// Fixture: an atom with a public entry point (index.ts).
export function Icon({ name }: { name: string }) {
  return <svg aria-hidden="true" data-name={name} />;
}
