// Creating an account (F01 design.md section 3): start (a code is emailed), verify the code, or ask for
// a new one. Public routes; their limits are in the sign-up service (AC-F01-13). The session token goes
// out only in the `set-auth-token` header, which the desktop's main part keeps (design.md section 4).
import {
  meResponseSchema,
  signUpBodySchema,
  signUpResendBodySchema,
  signUpResentSchema,
  signUpStartedSchema,
  signUpVerifyBodySchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { AccountsService } from "./accounts.service.ts";
import type { SignUpService } from "./sign-up.service.ts";

const config = { access: "public" as const };
const tags = ["accounts"];

const START = {
  config,
  schema: {
    summary: "Start creating an account",
    description:
      "Emails a 6-digit code. The answer is the same whether or not the email already has an account (its owner gets a notice instead).",
    tags,
    body: signUpBodySchema,
    response: { 202: signUpStartedSchema },
  },
};

const VERIFY = {
  config,
  schema: {
    summary: "Finish creating an account with the emailed code",
    description: "Creates the account and its personal workspace, and signs in (token in the set-auth-token header).",
    tags,
    body: signUpVerifyBodySchema,
    response: { 200: meResponseSchema },
  },
};

const RESEND = {
  config,
  schema: {
    summary: "Send a new sign-up code",
    description: "The previous code stops working.",
    tags,
    body: signUpResendBodySchema,
    response: { 202: signUpResentSchema },
  },
};

export const signUpRoutes: FastifyPluginAsyncZod<{ signUp: SignUpService; accounts: AccountsService }> = async (
  app,
  { signUp, accounts },
) => {
  app.post("/api/v1/auth/sign-up", START, async (request, reply) => {
    const signupId = await signUp.start(request.body, request.ip);
    return reply.status(202).send({ signupId, next: "code" as const });
  });

  app.post("/api/v1/auth/sign-up/verify", VERIFY, async (request, reply) => {
    const { userId, token } = await signUp.verify(request.body.signupId, request.body.code);
    reply.header("set-auth-token", token);
    return accounts.me(userId);
  });

  app.post("/api/v1/auth/sign-up/resend", RESEND, async (request, reply) => {
    await signUp.resend(request.body.signupId);
    return reply.status(202).send({ next: "code" as const });
  });
};
