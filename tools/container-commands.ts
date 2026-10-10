// The docker command lines behind `pnpm check:container` (tools/check-container.ts), kept separate so
// they can be tested: the container reaches the local services through host.docker.internal, its port
// is published on 127.0.0.1 only, and the settings come from .env at run time, never from the image.
export const IMAGE = "meetapp-api:check";
export const CONTAINER = "meetapp-api-check";
const SERVICE_HOSTS = ["POSTGRES_HOST", "REDIS_HOST", "LIVEKIT_HOST", "STORAGE_HOST", "MAILPIT_HOST"];

export function buildArgs(root: string): string[] {
  return ["build", "-f", `${root}/apps/api/Dockerfile`, "-t", IMAGE, root];
}

export function runArgs(envFile: string, hostPort: number): string[] {
  return [
    "run",
    "-d",
    "--name",
    CONTAINER,
    // On Linux (CI) host.docker.internal must be added; Docker Desktop has it already.
    "--add-host=host.docker.internal:host-gateway",
    "--env-file",
    envFile,
    ...SERVICE_HOSTS.flatMap((name) => ["-e", `${name}=host.docker.internal`]),
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
