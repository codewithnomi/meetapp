// API documentation at /docs and the OpenAPI file at /docs/json, built from the Zod schemas in
// packages/contracts. Registered ONLY in development; in test and production these paths are 404 (AC-F00-21).
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform, jsonSchemaTransformObject } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";

export async function registerDocs(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: { title: "MeetApp API", description: "MeetApp backend (development documentation)", version: "1.0.0" },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });
}
