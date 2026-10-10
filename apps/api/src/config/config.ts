// Settings from the environment (.env), checked once at startup (AC-F00-05, backend.md "Config").
// A missing or invalid setting stops the backend with its name and a pointer to .env.example.
// Values are never printed, so a wrong setting can't leak a password into the terminal or logs.
import { z } from "zod";

const port = z.coerce.number().int().min(1).max(65_535);
const text = z.string().min(1);
/** A setting with a default: missing or empty means the default. */
function withDefault(fallback: string) {
  return z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === "" ? fallback : value));
}
const host = withDefault("127.0.0.1");
/** Optional settings: an empty value means "off". */
const optional = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value === "" ? undefined : value));

export const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  API_HOST: text,
  API_PORT: port,
  POSTGRES_USER: text,
  POSTGRES_PASSWORD: text,
  POSTGRES_DB: text,
  POSTGRES_PORT: port,
  POSTGRES_HOST: host,
  REDIS_PORT: port,
  REDIS_HOST: host,
  LIVEKIT_PORT: port,
  LIVEKIT_HOST: host,
  LIVEKIT_API_KEY: text,
  LIVEKIT_API_SECRET: text,
  STORAGE_PORT: port,
  STORAGE_HOST: host,
  STORAGE_ACCESS_KEY: text,
  STORAGE_SECRET_KEY: text,
  STORAGE_BUCKET: text,
  STORAGE_REGION: text,
  MAILPIT_SMTP_PORT: port,
  MAILPIT_HOST: host,
  EMAIL_FROM: withDefault("MeetApp <no-reply@meetapp.local>"),
  SENTRY_DSN: optional,
  OTEL_EXPORTER_OTLP_ENDPOINT: optional,
});

export type Config = z.infer<typeof configSchema>;

export class ConfigError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`The backend can't start:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
    this.problems = problems;
  }
}

/** Validates the environment. Throws ConfigError naming each bad setting (never its value). */
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const result = configSchema.safeParse(env);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => {
    const name = String(issue.path[0] ?? "setting");
    const missing = env[name] === undefined || env[name] === "";
    return `${missing ? "Missing setting" : "Invalid setting"} ${name}: set it in .env (see .env.example).`;
  });
  throw new ConfigError([...new Set(problems)]);
}
