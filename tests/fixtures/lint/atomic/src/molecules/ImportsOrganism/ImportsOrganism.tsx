// Fixture: a molecule importing an organism (must fail: molecules may not import higher levels).
import { Form } from "../../organisms/Form/index.ts";

export function ImportsOrganism({ text }: { text: string }) {
  return <Form text={text} />;
}
