// Fixture: an atom importing an organism (must fail: atoms may not import higher levels).
import { Form } from "../../organisms/Form/index.ts";

export function ImportsOrganism({ text }: { text: string }) {
  return <Form text={text} />;
}
