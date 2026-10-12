// Google and Microsoft in Better Auth (F01 design.md section 3, AC-F01-07, 08). Each is switched on
// only when its keys are in the settings. Only a verified email may create or join an account; the
// check runs in each provider's profile step, and a final gate refuses everything else.
import type { SocialProviders } from "better-auth/social-providers";
import { signInProviders, type Config } from "../config/config.ts";
import {
  PROVIDER_EMAIL_UNVERIFIED,
  googleEmailVerified,
  microsoftEmailVerified,
} from "../modules/accounts/provider-profile.ts";

export function socialProviders(config: Config): SocialProviders {
  const enabled = signInProviders(config);
  const providers: SocialProviders = {};
  if (enabled.google) {
    providers.google = {
      clientId: config.GOOGLE_CLIENT_ID ?? "",
      clientSecret: config.GOOGLE_CLIENT_SECRET ?? "",
      prompt: "select_account",
      mapProfileToUser: (profile) => ({ emailVerified: googleEmailVerified(profile) }),
    };
  }
  if (enabled.microsoft) {
    providers.microsoft = {
      clientId: config.MICROSOFT_CLIENT_ID ?? "",
      clientSecret: config.MICROSOFT_CLIENT_SECRET ?? "",
      tenantId: "common",
      prompt: "select_account",
      // A national cloud or the tests' fake provider has no photo at Microsoft's Graph address.
      ...(config.MICROSOFT_AUTHORITY !== undefined && {
        authority: config.MICROSOFT_AUTHORITY,
        disableProfilePhoto: true,
      }),
      mapProfileToUser: (profile) => ({ emailVerified: microsoftEmailVerified(profile) }),
    };
  }
  return providers;
}

/** Better Auth's last check before it creates, links or signs in a Google/Microsoft user. */
export function validateUserInfo({ user, source }: { user: { emailVerified?: unknown }; source: { method: string } }) {
  if (source.method === "oauth" && user.emailVerified !== true) return { error: PROVIDER_EMAIL_UNVERIFIED };
  return undefined;
}
