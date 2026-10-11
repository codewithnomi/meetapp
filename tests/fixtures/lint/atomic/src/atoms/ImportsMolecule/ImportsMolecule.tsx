// Fixture: an atom importing a molecule (must fail: atoms may not import higher levels).
import { Field } from "../../molecules/Field/index.ts";

export function ImportsMolecule({ text }: { text: string }) {
  return <Field text={text} />;
}
