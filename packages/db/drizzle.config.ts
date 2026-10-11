// drizzle-kit settings: `pnpm --filter @meetapp/db db:generate` turns schema changes into a new
// SQL migration in ./migrations. Generating needs no database connection.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
});
