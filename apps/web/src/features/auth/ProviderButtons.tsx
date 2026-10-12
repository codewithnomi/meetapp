// "Continue with Google / Microsoft" on the sign-in and create-account screens (approved canvas,
// AC-F01-07), followed by the "or" line. Only providers set up on the backend are shown; with none,
// nothing is shown at all.
import { Button } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { SignInProvider } from "./auth-bridge.ts";
import { useProviders } from "./providers.ts";

const ORDER: readonly SignInProvider[] = ["google", "microsoft"];

export function ProviderButtons({ dividerLabel }: { dividerLabel: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const enabled = useProviders();
  const shown = ORDER.filter((provider) => enabled[provider]);
  if (shown.length === 0) return null;
  return (
    <>
      <div className="flex flex-col gap-2.5">
        {shown.map((provider) => (
          <Button
            key={provider}
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => void navigate("/browser-sign-in", { state: { provider } })}
          >
            {t(`auth.providers.${provider}`)}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-[12px] text-ink-muted">
        <span className="h-px flex-1 bg-line" />
        {dividerLabel}
        <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}
