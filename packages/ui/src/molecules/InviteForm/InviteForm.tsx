// InviteForm (molecule): "Invite by email" from the approved "People" canvas (AC-F01-17): one or more
// email addresses, the role (only for people who may invite admins) and "Send invitations". The page
// keeps the text and the role (controlled), checks the addresses and sends them; an error shows under
// the field and is read out. All words arrive as props.
import type { FormEvent } from "react";
import { Button } from "../../atoms/Button/index.ts";
import { Input } from "../../atoms/Input/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export type InviteRole = "member" | "admin";

export interface InviteFormLabels {
  emails: string;
  placeholder: string;
  hint: string;
  role: string;
  roles: Record<InviteRole, string>;
  submit: string;
  /** Read out while sending. */
  pending: string;
}

export interface InviteFormProps {
  value: string;
  onValueChange: (value: string) => void;
  role: InviteRole;
  onRoleChange: (role: InviteRole) => void;
  /** The owner and admins choose a role; members always invite as member. */
  canInviteAdmin: boolean;
  pending?: boolean;
  /** Already translated: what is wrong with the addresses or the sending. */
  error?: string | undefined;
  onSubmit: () => void;
  labels: InviteFormLabels;
}

function RoleSelect({ role, onRoleChange, labels }: Pick<InviteFormProps, "role" | "onRoleChange" | "labels">) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="invite-role" className="px-4 text-[13px] font-[550] leading-4.5">
        {labels.role}
      </label>
      <select
        id="invite-role"
        value={role}
        onChange={(event) => onRoleChange(event.target.value === "admin" ? "admin" : "member")}
        className={cx(
          "box-border h-10 cursor-pointer rounded-full border border-line-strong bg-surface-sunken px-4 font-[inherit] text-ink",
          FOCUS_RING,
        )}
      >
        <option value="member">{labels.roles.member}</option>
        <option value="admin">{labels.roles.admin}</option>
      </select>
    </div>
  );
}

export function InviteForm(props: InviteFormProps) {
  const { value, onValueChange, canInviteAdmin, pending = false, error, onSubmit, labels } = props;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form noValidate onSubmit={submit} className="flex flex-wrap items-start gap-3">
      <Input
        id="invite-emails"
        type="text"
        inputMode="email"
        autoComplete="off"
        className="flex-[1_1_280px]"
        label={labels.emails}
        placeholder={labels.placeholder}
        hint={labels.hint}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        {...(error ? { error } : {})}
      />
      {canInviteAdmin ? <RoleSelect role={props.role} onRoleChange={props.onRoleChange} labels={labels} /> : null}
      {/* Lined up with the fields, below their labels. */}
      <div className="flex flex-col gap-1.5">
        <span aria-hidden="true" className="h-4.5" />
        {pending ? (
          <Button type="submit" icon="send" loading loadingLabel={labels.pending}>
            {labels.submit}
          </Button>
        ) : (
          <Button type="submit" icon="send">
            {labels.submit}
          </Button>
        )}
      </div>
    </form>
  );
}
