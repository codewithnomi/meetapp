// The signed-in person (F01 design.md section 8): `GET /api/v1/me` and accepting the terms.
import { z } from "zod";
import { workspaceSchema } from "./workspaces.ts";

export const meResponseSchema = z
  .object({
    user: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      /** False after a first Google/Microsoft sign-in until the terms are accepted (AC-F01-07). */
      termsAccepted: z.boolean(),
      theme: z.enum(["light", "dark", "system"]).nullable(),
      accent: z.string().nullable(),
    }),
    /**
     * Every workspace they are in, with their role; Personal first (AC-F01-14, 23). `pendingRequests`
     * counts requests to join waiting for the owner and admins (0 for members; AC-F01-19).
     */
    workspaces: z.array(workspaceSchema.extend({ pendingRequests: z.number().int() })),
    /** The workspace to open: the last used while they are still in it, else Personal (AC-F01-16). */
    currentWorkspaceId: z.uuid().nullable(),
  })
  .meta({ id: "Me", description: "The signed-in person and their workspaces." });

export type MeResponse = z.infer<typeof meResponseSchema>;

export const acceptTermsBodySchema = z
  .object({
    /** "I agree to the Terms and Privacy Policy" */
    acceptTerms: z.literal(true),
    /** "I am 16 or older" (privacy-legal.md §5) */
    ageConfirmed: z.literal(true),
  })
  .meta({ id: "AcceptTerms" });

export const THEME_CHOICES = ["light", "dark", "system"] as const;
export const ACCENT_CHOICES = ["sky", "blue", "purple", "pink", "red", "orange", "green", "teal"] as const;

/** Start creating an account (AC-F01-01): a code is emailed; the account exists only after it. */
export const signUpBodySchema = z
  .object({
    email: z.email().max(254),
    name: z.string().trim().min(1).max(60),
    /** Length and common-password checks give a PASSWORD_WEAK answer (AC-F01-03). */
    password: z.string().min(1).max(1_000),
    termsAccepted: z.literal(true),
    /** The computer's current look, so a new account starts with it (AC-F01-26). */
    theme: z.enum(THEME_CHOICES).optional(),
    accent: z.enum(ACCENT_CHOICES).optional(),
  })
  .meta({ id: "SignUp" });

/** The same answer whether or not the email already has an account (AC-F01-02). */
export const signUpStartedSchema = z
  .object({ signupId: z.uuid(), next: z.literal("code") })
  .meta({ id: "SignUpStarted" });

export const signUpVerifyBodySchema = z
  .object({ signupId: z.uuid(), code: z.string().regex(/^\d{6}$/) })
  .meta({ id: "SignUpVerify" });

export const signUpResendBodySchema = z.object({ signupId: z.uuid() }).meta({ id: "SignUpResend" });

export const signUpResentSchema = z.object({ next: z.literal("code") }).meta({ id: "SignUpResent" });

const emailedCode = z.string().regex(/^\d{6}$/);
/** The same rule as sign-up; length and common-password checks give PASSWORD_WEAK (AC-F01-03). */
const newPassword = z.string().min(1).max(1_000);

/** Forgot password (AC-F01-09): the code from `/api/auth/email-otp/request-password-reset`. */
export const resetPasswordBodySchema = z
  .object({ email: z.email().max(254), code: emailedCode, newPassword })
  .meta({ id: "ResetPassword" });

/** Change password (AC-F01-10): exactly one of the current password or an emailed reset code. */
export const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(1_000).optional(),
    code: emailedCode.optional(),
    newPassword,
  })
  .refine((body) => (body.currentPassword === undefined) !== (body.code === undefined), {
    message: "Send either the current password or the emailed code.",
  })
  .meta({ id: "ChangePassword" });

/** The workspace the app shows now; opened first at the next start (AC-F01-16). */
export const lastWorkspaceBodySchema = z.object({ workspaceId: z.uuid() }).meta({ id: "LastWorkspace" });
