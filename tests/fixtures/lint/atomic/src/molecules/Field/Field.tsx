// Fixture: a molecule importing an atom (allowed).
import { Label } from "../../atoms/Label/index.ts";

export function Field({ text }: { text: string }) {
  return (
    <div>
      <Label text={text} />
    </div>
  );
}
