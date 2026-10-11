// Settings from the environment (.env), checked once at startup (AC-F00-05, backend.md "Config").
// A missing or invalid setting stops the backend with its name and a pointer to .env.example.
// Values are never printed, so a wrong setting can't leak a password into the terminal or logs.
import { z } from "zod";
import { isAllowedOtlpEndpoint } from "./otlp-endpoint.ts";

export { isAllowedOtlpEndpoint };

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

/** A secret key: long enough that it can't be guessed. */
const secret = z.string().min(32);
const PROVIDER_KEYS = [
  ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
] as const;

export const configSchema = z
  .object({
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
    // Only this computer, or https (otlp-endpoint.ts).
    OTEL_EXPORTER_OTLP_ENDPOINT: optional.refine((value) => value === undefined || isAllowedOtlpEndpoint(value)),
    // Sign-in (F01, security rule S7): signs sessions; derives the keys that encrypt stored data.
    BETTER_AUTH_SECRET: secret,
    DATA_ENCRYPTION_KEY: secret,
    // Google and Microsoft sign-in: both keys of a provider, or neither (then its button is hidden).
    GOOGLE_CLIENT_ID: optional,
    GOOGLE_CLIENT_SECRET: optional,
    MICROSOFT_CLIENT_ID: optional,
    MICROSOFT_CLIENT_SECRET: optional,
    // Shown on the profile screen for data requests (privacy-legal.md §2).
    SUPPORT_EMAIL: z.email(),
    // The backend's address as people's browsers reach it (invitation page, Google/Microsoft hand-off).
    APP_PUBLIC_URL: z.url({ protocol: /^https?$/ }),
  })
  .superRefine((config, context) => {
    for (const [id, secretKey] of PROVIDER_KEYS) {
      if ((config[id] === undefined) !== (config[secretKey] === undefined)) {
        context.addIssue({
          code: "custom",
          path: [config[id] === undefined ? id : secretKey],
          message: "both or neither",
        });
      }
    }
  });

export type Config = z.infer<typeof configSchema>;

/** Which sign-in providers are switched on (design.md section 3). */
export function signInProviders(config: Config): { google: boolean; microsoft: boolean } {
  return { google: config.GOOGLE_CLIENT_ID !== undefined, microsoft: config.MICROSOFT_CLIENT_ID !== undefined };
}

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
