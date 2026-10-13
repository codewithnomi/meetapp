// Google/Microsoft sign-in for the desktop app through the computer's browser (F01 design.md section 4).
import { z } from "zod";

export const SIGN_IN_PROVIDERS = ["google", "microsoft"] as const;
export type SignInProvider = (typeof SIGN_IN_PROVIDERS)[number];

/** Which Google/Microsoft buttons to show; a provider without keys in the settings is hidden (AC-F01-07). */
export const providersResponseSchema = z
  .object({ google: z.boolean(), microsoft: z.boolean() })
  .meta({ id: "SignInProviders" });

/** The app's secret `verifier` stays in the app; only its SHA-256 (hex) is sent here. */
export const desktopInitBodySchema = z
  .object({ provider: z.enum(SIGN_IN_PROVIDERS), challenge: z.string().regex(/^[0-9a-f]{64}$/) })
  .meta({ id: "DesktopSignInInit" });

/**
 * `matchCode` is shown in the app and on the browser page, so the person can check they match.
 * `startUrl` is the link to open in the browser, on the backend's public address (APP_PUBLIC_URL), so
 * the whole browser trip stays on the one address Google/Microsoft send people back to.
 */
export const desktopInitResponseSchema = z
  .object({ requestId: z.uuid(), matchCode: z.string().regex(/^\d{4}$/), startUrl: z.url() })
  .meta({ id: "DesktopSignInStarted" });

export const desktopExchangeBodySchema = z
  .object({ requestId: z.uuid(), verifier: z.string().min(43).max(128) })
  .meta({ id: "DesktopSignInExchange" });

/** Not finished in the browser yet; ask again in a second. */
export const desktopPendingSchema = z.object({ status: z.literal("pending") }).meta({ id: "DesktopSignInPending" });
