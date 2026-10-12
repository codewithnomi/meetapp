// The form's main button: a spinner and "busy" while the request runs, so a double click can't send it
// twice (AC-F01-29).
import { Button } from "@meetapp/ui";

export interface SubmitButtonProps {
  label: string;
  /** Said by screen readers while the request runs, e.g. "Signing in". */
  pendingLabel: string;
  pending: boolean;
  disabled?: boolean;
}

export function SubmitButton({ label, pendingLabel, pending, disabled = false }: SubmitButtonProps) {
  return pending ? (
    <Button type="submit" size="lg" className="w-full" loading loadingLabel={pendingLabel}>
      {label}
    </Button>
  ) : (
    <Button type="submit" size="lg" className="w-full" disabled={disabled}>
      {label}
    </Button>
  );
}
