// Fixture: an atom using a sibling atom through its index.ts (allowed).
import { Icon } from "../Icon/index.ts";

export function IconButton({ label }: { label: string }) {
  return (
    <button type="button" aria-label={label}>
      <Icon name="close" />
    </button>
  );
}
