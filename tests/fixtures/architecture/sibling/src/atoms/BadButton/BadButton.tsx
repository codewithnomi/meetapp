// Fixture: an atom reaching into a sibling atom's internal file (not allowed).
import { Icon } from "../Icon/Icon.tsx";

export function BadButton({ label }: { label: string }) {
  return (
    <button type="button" aria-label={label}>
      <Icon name="close" />
    </button>
  );
}
