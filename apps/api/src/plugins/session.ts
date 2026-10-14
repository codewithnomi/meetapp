// Who is calling (security rule S1, F01 design.md sections 5 and 8). Every /api/v1 route needs a
// signed-in person unless the route says `access: "public"`; until the terms are accepted only routes
// marked `access: "signed-in"` work (403 TERMS_REQUIRED), so the terms gate can't be skipped by
// calling the backend directly.
import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "./errors.ts";

export interface SignedInUser {
  id: string;
  email: string;
  name: string;
  termsAccepted: boolean;
}

/** Reads the session from a request's headers; undefined when nobody is signed in. */
export interface SessionReader {
  read: (request: FastifyRequest) => Promise<SignedInUser | undefined>;
}

declare module "fastify" {
  interface FastifyContextConfig {
    /**
     * Default: signed in and terms accepted. "signed-in": terms not needed. "public": anyone.
     * "optional": anyone, and the person when signed in with the terms accepted (F02: guests and
     * members find and join meetings through the same routes).
     */
    access?: "public" | "signed-in" | "optional";
  }
  interface FastifyRequest {
    user?: SignedInUser;
  }
}

const API_PREFIX = "/api/v1/";
const NOBODY: SessionReader = { read: async () => undefined };

/** The signed-in person of a request that passed the session check. */
export function signedInUser(request: FastifyRequest): SignedInUser {
  if (!request.user) throw new AppError(401, "UNAUTHORIZED", "Sign in to continue.");
  return request.user;
}

export function registerSessionCheck(app: FastifyInstance, reader: SessionReader = NOBODY): void {
  app.addHook("onRequest", async (request) => {
    const access = request.routeOptions.config.access;
    // Unknown addresses keep answering 404, and browsers' CORS "preflight" checks carry no sign-in.
    if (request.is404 || request.method === "OPTIONS") return;
    // The route's registered address, not the raw one: "/api/%761/me" reaches /api/v1/me too.
    if (!(request.routeOptions.url ?? "").startsWith(API_PREFIX) || access === "public") return;
    const user = await reader.read(request);
    if (access === "optional") {
      if (user?.termsAccepted) request.user = user;
      return;
    }
    if (!user) throw new AppError(401, "UNAUTHORIZED", "Sign in to continue.");
    request.user = user;
    if (!user.termsAccepted && access !== "signed-in") {
      throw new AppError(403, "TERMS_REQUIRED", "Accept the Terms and Privacy Policy to continue.");
    }
  });
}
