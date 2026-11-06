// `GET` and `PUT /api/v1/me/notification-settings` (F04 design 5): always the signed-in person's own.
import { notificationSettingsBodySchema, notificationSettingsSchema } from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { signedInUser } from "../../plugins/session.ts";
import type { NotificationSettingsService } from "./notification-settings.service.ts";

const tags = ["notifications"];

export const notificationSettingsRoutes: FastifyPluginAsyncZod<{ settings: NotificationSettingsService }> = async (
  app,
  { settings },
) => {
  app.get(
    "/api/v1/me/notification-settings",
    {
      schema: {
        summary: "Which notifications show: messages, mentions, lobby, sound, message preview",
        tags,
        response: { 200: notificationSettingsSchema },
      },
    },
    (request) => settings.read(signedInUser(request).id),
  );
  app.put(
    "/api/v1/me/notification-settings",
    {
      schema: {
        summary: "Turn notifications on or off (any of the five; 20 changes a minute)",
        tags,
        body: notificationSettingsBodySchema,
        response: { 200: notificationSettingsSchema },
      },
    },
    (request) => settings.change(signedInUser(request).id, request.body),
  );
};
