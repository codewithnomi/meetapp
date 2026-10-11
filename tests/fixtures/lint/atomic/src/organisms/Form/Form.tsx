// Fixture: an organism importing a molecule and an atom (allowed).
import { Label } from "../../atoms/Label/index.ts";
import { Field } from "../../molecules/Field/index.ts";

export function Form({ text }: { text: string }) {
  return (
    <form>
      <Label text={text} />
      <Field text={text} />
    </form>
  );
}
