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

/** The shared local values from .env.example: fine on a Mac, never online (anyone can read them). */
const LOCAL_ONLY_SECRET = /local_dev/i;
const SECRETS = ["BETTER_AUTH_SECRET", "DATA_ENCRYPTION_KEY", "LIVEKIT_API_SECRET"] as const;

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

/**
 * The call server's address for the app (F02 design section 5, AC-F02-53): wss anywhere; plain ws only
 * on this computer and never in production.
 */
export function isAllowedCallServerUrl(value: string, environment: string): boolean {
  if (!URL.canParse(value)) return false;
  const { protocol, hostname } = new URL(value);
  if (protocol === "wss:") return true;
  return protocol === "ws:" && environment !== "production" && LOCAL_HOSTS.has(hostname);
}

/** https anywhere; plain http only on this computer and only outside production (desktop tests). */
function isAllowedAuthority(value: string, environment: string): boolean {
  if (!URL.canParse(value)) return false;
  const { protocol, hostname } = new URL(value);
  if (protocol === "https:") return true;
  return protocol === "http:" && environment !== "production" && LOCAL_HOSTS.has(hostname);
}

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
    // Where the app connects to the call server; empty means ws://127.0.0.1:<LIVEKIT_PORT> (development).
    LIVEKIT_PUBLIC_URL: optional,
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
    // Where Microsoft sign-in happens; empty means Microsoft's own (login.microsoftonline.com). Set only
    // for a national Microsoft cloud, or to a local fake provider in the desktop tests.
    MICROSOFT_AUTHORITY: optional,
    // Shown on the profile screen for data requests (privacy-legal.md §2).
    SUPPORT_EMAIL: z.email(),
    // The backend's address as people's browsers reach it (invitation page, Google/Microsoft hand-off).
    APP_PUBLIC_URL: z.url({ protocol: /^https?$/ }),
  })
  .superRefine((config, context) => {
    if (config.MICROSOFT_AUTHORITY !== undefined && !isAllowedAuthority(config.MICROSOFT_AUTHORITY, config.NODE_ENV)) {
      context.addIssue({
        code: "custom",
        path: ["MICROSOFT_AUTHORITY"],
        message: "must be https (http only on this computer, and never in production)",
      });
    }
    const callServer = config.LIVEKIT_PUBLIC_URL;
    if (
      (callServer === undefined && config.NODE_ENV === "production") ||
      (callServer !== undefined && !isAllowedCallServerUrl(callServer, config.NODE_ENV))
    ) {
      context.addIssue({
        code: "custom",
        path: ["LIVEKIT_PUBLIC_URL"],
        message: "must be wss:// (ws:// only on this computer, and never in production)",
      });
    }
    for (const name of SECRETS) {
      if (config.NODE_ENV === "production" && LOCAL_ONLY_SECRET.test(config[name])) {
        context.addIssue({ code: "custom", path: [name], message: "is the local example value; set a real secret" });
      }
    }
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

/** The call server's address as the app reaches it (sent with every pass, F02 design section 5). */
export function callServerUrl(config: Config): string {
  return config.LIVEKIT_PUBLIC_URL ?? `ws://127.0.0.1:${String(config.LIVEKIT_PORT)}`;
}

/** Where the backend reaches the call server's admin API: https online (S6), plain http only on this computer. */
export function callServerAdminUrl(config: Config): string {
  const scheme = config.NODE_ENV === "production" ? "https" : "http";
  return `${scheme}://${config.LIVEKIT_HOST}:${String(config.LIVEKIT_PORT)}`;
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
