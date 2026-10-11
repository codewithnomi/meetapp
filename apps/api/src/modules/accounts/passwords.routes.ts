// Reset password, change password and sign out everywhere (F01 design.md section 8). The new session's
// token goes out only in the `set-auth-token` header, which the desktop's main part keeps (section 4).
import { changePasswordBodySchema, meResponseSchema, resetPasswordBodySchema } from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { signedInUser } from "../../plugins/session.ts";
import type { AccountsService } from "./accounts.service.ts";
import type { PasswordsService } from "./passwords.service.ts";

const tags = ["accounts"];

const RESET = {
  config: { access: "public" as const },
  schema: {
    summary: "Choose a new password with the emailed reset code",
    description:
      "The code comes from /api/auth/email-otp/request-password-reset. Signs out every device and signs in here (token in the set-auth-token header).",
    tags,
    body: resetPasswordBodySchema,
    response: { 200: meResponseSchema },
  },
};

const CHANGE = {
  config: { access: "signed-in" as const },
  schema: {
    summary: "Change my password",
    description:
      "With the current password, or an emailed reset code when the account has none. Signs out every other device; this one gets a new token in the set-auth-token header. A wrong current password answers 400 PASSWORD_WRONG.",
    tags,
    body: changePasswordBodySchema,
    response: { 200: meResponseSchema },
  },
};

const SIGN_OUT_EVERYWHERE = {
  config: { access: "signed-in" as const },
  schema: {
    summary: "Sign out everywhere",
    description: "Ends every session of the signed-in person, this one included.",
    tags,
  },
};

export const passwordsRoutes: FastifyPluginAsyncZod<{
  passwords: PasswordsService;
  accounts: AccountsService;
}> = async (app, { passwords, accounts }) => {
  app.post("/api/v1/auth/reset-password", RESET, async (request, reply) => {
    const { email, code, newPassword } = request.body;
    const { userId, token } = await passwords.reset(email, code, newPassword);
    reply.header("set-auth-token", token);
    return accounts.me(userId);
  });

  app.post("/api/v1/me/password", CHANGE, async (request, reply) => {
    const user = signedInUser(request);
    reply.header("set-auth-token", await passwords.change(user, request.body));
    return accounts.me(user.id);
  });

  app.post("/api/v1/auth/sign-out-everywhere", SIGN_OUT_EVERYWHERE, async (request, reply) => {
    await passwords.signOutEverywhere(signedInUser(request).id);
    return reply.status(204).send();
  });
};
