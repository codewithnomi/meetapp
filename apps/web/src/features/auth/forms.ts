// The sign-in forms' rules (F01 design.md section 3, AC-F01-03): checked on the screen first for a
// quick answer; the backend checks them again (and the common-password list). Messages are text keys.
import { z } from "zod";

const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;

const emailField = z.email({ error: "auth.validation.email" }).max(254, { error: "auth.validation.email" });
const passwordField = z
  .string()
  .min(PASSWORD_MIN, { error: "auth.validation.passwordShort" })
  .max(PASSWORD_MAX, { error: "auth.validation.passwordLong" });
const nameField = z
  .string()
  .trim()
  .min(1, { error: "auth.validation.name" })
  .max(60, { error: "auth.validation.name" });

export const emailForm = z.object({ email: emailField });
export const passwordForm = z.object({ password: z.string().min(1, { error: "auth.validation.passwordShort" }) });
export const createAccountForm = z.object({
  email: emailField,
  name: nameField,
  password: passwordField,
  terms: z.literal(true, { error: "auth.validation.terms" }),
});
export const newPasswordForm = z
  .object({ password: passwordField, repeat: z.string() })
  .refine((form) => form.password === form.repeat, { error: "auth.validation.passwordsDiffer", path: ["repeat"] });
export const termsForm = z.object({ agree: z.literal(true, { error: "auth.validation.terms" }) });

/** What the code screen needs: why the code was sent, and to whom. */
export type CodeScreenState =
  { purpose: "signUp"; email: string; signupId: string } | { purpose: "signIn" | "reset"; email: string };

/** What the new-password screen needs after the reset code. */
export interface NewPasswordState {
  email: string;
  code: string;
}
