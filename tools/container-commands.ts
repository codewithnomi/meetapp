// The docker command lines behind `pnpm check:container` (tools/check-container.ts), kept separate so
// they can be tested: the container joins the local services' own network and reaches them by name on
// their inside ports (the services listen on 127.0.0.1 only, which a container can't reach on Linux),
// its port is published on 127.0.0.1 only, and the settings come from .env at run time, never the image.
export const IMAGE = "meetapp-api:check";
export const CONTAINER = "meetapp-api-check";
/** The compose project "meetapp" (infra/docker-compose.yml) puts its services on this network. */
export const SERVICES_NETWORK = "meetapp_default";

/** Each service by its compose name and the port it listens on inside its container. */
const SERVICES: Record<string, string> = {
  POSTGRES_HOST: "postgres",
  POSTGRES_PORT: "5432",
  REDIS_HOST: "redis",
  REDIS_PORT: "6379",
  LIVEKIT_HOST: "livekit",
  LIVEKIT_PORT: "7880",
  STORAGE_HOST: "storage",
  STORAGE_PORT: "9000",
  MAILPIT_HOST: "mailpit",
  MAILPIT_SMTP_PORT: "1025",
};

export function buildArgs(root: string): string[] {
  return ["build", "-f", `${root}/apps/api/Dockerfile`, "-t", IMAGE, root];
}

export function runArgs(envFile: string, hostPort: number): string[] {
  return [
    "run",
    "-d",
    "--name",
    CONTAINER,
    "--network",
    SERVICES_NETWORK,
    "--env-file",
    envFile,
    ...Object.entries(SERVICES).flatMap(([name, value]) => ["-e", `${name}=${value}`]),
    "-e",
    "NODE_ENV=production",
    "-e",
    "API_HOST=0.0.0.0",
    "-e",
    "API_PORT=3000",
    "-p",
    `127.0.0.1:${String(hostPort)}:3000`,
    IMAGE,
  ];
}

/** The scanner reads the exported files read-only, with no network. */
export function secretScanArgs(gitleaksImage: string, exportDir: string, configFile: string): string[] {
  return [
    "run",
    "--rm",
    "--network",
    "none",
    "-v",
    `${exportDir}:/scan:ro`,
    "-v",
    `${configFile}:/config/gitleaks.toml:ro`,
    gitleaksImage,
    "dir",
    "/scan",
    "--config",
    "/config/gitleaks.toml",
    "--no-banner",
    "--redact",
  ];
}
