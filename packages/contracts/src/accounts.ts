// The signed-in person (F01 design.md section 8): `GET /api/v1/me` and accepting the terms.
import { z } from "zod";

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
  })
  .meta({ id: "Me", description: "The signed-in person." });

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
