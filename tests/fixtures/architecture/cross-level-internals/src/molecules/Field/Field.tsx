// Fixture: a molecule reaching into an atom's internal file instead of its index.ts (must fail).
import { Label } from "../../atoms/Label/Label.tsx";

export function Field({ text }: { text: string }) {
  return <Label text={text} />;
}
