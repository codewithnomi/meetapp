// Profile routes (F01 design.md sections 6 and 8): the name, the saved look, and the photo. A photo is
// sent as the request body itself (any content type: the bytes decide, AC-F01-25), at most 5 MB, which
// Fastify refuses with 413 before reading further.
import {
  avatarQuerySchema,
  preferencesBodySchema,
  updateProfileBodySchema,
  userParamsSchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { signedInUser } from "../../plugins/session.ts";
import { idParam } from "../../plugins/workspace-access.ts";
import { MAX_PHOTO_BYTES } from "./avatar-image.ts";
import type { ProfileService } from "./profile.service.ts";

const tags = ["accounts"];
const PHOTO_RULE = "400 PHOTO_INVALID unless it is a JPEG, PNG or WebP image; 413 over 5 MB.";

const RENAME = {
  schema: { summary: "Change your name", description: "1–60 characters.", tags, body: updateProfileBodySchema },
};
const LOOK = {
  schema: {
    summary: "Save your theme and accent",
    description: "Applied when you sign in anywhere.",
    tags,
    body: preferencesBodySchema,
  },
};
const UPLOAD = {
  bodyLimit: MAX_PHOTO_BYTES,
  schema: {
    summary: "Upload your photo",
    description: `The image file as the body. Re-encoded to 512×512 WebP without location or camera details. ${PHOTO_RULE}`,
    tags,
    response: { 200: z.object({ photoUrl: z.string() }).meta({ id: "PhotoSaved" }) },
  },
};
const REMOVE = { schema: { summary: "Remove your photo", description: "Your initials show again.", tags } };
const PHOTO = {
  schema: {
    summary: "Someone's photo",
    description: "Only for the person and people who share a workspace with them; 404 otherwise or without a photo.",
    tags,
    params: userParamsSchema,
    querystring: avatarQuerySchema,
  },
};

export const profileRoutes: FastifyPluginAsyncZod<{ profile: ProfileService }> = async (app, { profile }) => {
  app.patch("/api/v1/me", RENAME, async (request, reply) => {
    await profile.setName(signedInUser(request).id, request.body.name);
    return reply.status(204).send();
  });
  app.patch("/api/v1/me/preferences", LOOK, async (request, reply) => {
    await profile.setLook(signedInUser(request).id, request.body);
    return reply.status(204).send();
  });
  app.delete("/api/v1/me/avatar", REMOVE, async (request, reply) => {
    await profile.removePhoto(signedInUser(request).id);
    return reply.status(204).send();
  });
  app.get("/api/v1/users/:userId/avatar", PHOTO, async (request, reply) => {
    const bytes = await profile.photo(signedInUser(request).id, idParam(request.params.userId));
    return reply.type("image/webp").header("cache-control", "private, max-age=60").send(Buffer.from(bytes));
  });
  // Its own scope, so only this route takes raw bytes of any type.
  await app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser("*", { parseAs: "buffer", bodyLimit: MAX_PHOTO_BYTES }, (_request, body, done) => {
      done(null, body);
    });
    scope.put("/api/v1/me/avatar", UPLOAD, async (request) => {
      const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
      return profile.setPhoto(signedInUser(request).id, body);
    });
  });
};
