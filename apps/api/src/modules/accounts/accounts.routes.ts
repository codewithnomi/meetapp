// GET /api/v1/me and POST /api/v1/me/terms (F01 design.md section 8). Both work before the terms
// are accepted, so a first Google/Microsoft user can see who they are and accept (AC-F01-07).
import { acceptTermsBodySchema, meResponseSchema } from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { signedInUser } from "../../plugins/session.ts";
import type { AccountsService } from "./accounts.service.ts";

export const accountsRoutes: FastifyPluginAsyncZod<{ accounts: AccountsService }> = async (app, { accounts }) => {
  app.get(
    "/api/v1/me",
    {
      config: { access: "signed-in" },
      schema: {
        summary: "Who is signed in?",
        description: "The signed-in person's name, email and settings. 401 when nobody is signed in.",
        tags: ["accounts"],
        response: { 200: meResponseSchema },
      },
    },
    async (request) => accounts.me(signedInUser(request).id),
  );

  app.post(
    "/api/v1/me/terms",
    {
      config: { access: "signed-in" },
      schema: {
        summary: "Accept the terms",
        description:
          "Records the Terms and Privacy Policy and the 16+ statement. Needed once before anything else works.",
        tags: ["accounts"],
        body: acceptTermsBodySchema,
        response: { 200: meResponseSchema },
      },
    },
    async (request) => {
      const { id } = signedInUser(request);
      await accounts.acceptTerms(id);
      return accounts.me(id);
    },
  );
};
