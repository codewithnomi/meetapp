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
