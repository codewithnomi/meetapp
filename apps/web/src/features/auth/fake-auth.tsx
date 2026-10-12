// Test helper (tests only) for the sign-in screens: a fake `window.meetapp.auth` (every call recorded, answers set
// per test), plus a fresh data cache and router around the screen.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import type { AuthBridge, SignedInUser } from "./index.ts";

export const PAT: SignedInUser = {
  id: "u-1",
  name: "Pat Lee",
  email: "pat@example.test",
  termsAccepted: true,
  theme: null,
  accent: null,
};

export type FakeAuth = { [K in keyof AuthBridge]: ReturnType<typeof vi.fn<AuthBridge[K]>> };

/** Every call answers like a signed-out app until a test says otherwise. */
export function installFakeAuth(signedIn: SignedInUser | null = null): FakeAuth {
  const signedInResult = async () =>
    signedIn ? { ok: true as const, user: signedIn } : { ok: false as const, code: "SIGNED_OUT" };
  const ok = async () => ({ ok: true as const });
  const auth: FakeAuth = {
    startProviderSignIn: vi.fn<AuthBridge["startProviderSignIn"]>(async () => ({ ok: true, matchCode: "4821" })),
    finishProviderSignIn: vi.fn<AuthBridge["finishProviderSignIn"]>(async () => ({ ok: true, user: PAT })),
    cancelProviderSignIn: vi.fn<AuthBridge["cancelProviderSignIn"]>(ok),
    signInWithPassword: vi.fn<AuthBridge["signInWithPassword"]>(async () => ({ ok: true, user: PAT })),
    requestCode: vi.fn<AuthBridge["requestCode"]>(ok),
    signInWithCode: vi.fn<AuthBridge["signInWithCode"]>(async () => ({ ok: true, user: PAT })),
    startSignUp: vi.fn<AuthBridge["startSignUp"]>(async () => ({ ok: true, signupId: "s-1" })),
    resendSignUpCode: vi.fn<AuthBridge["resendSignUpCode"]>(ok),
    finishSignUp: vi.fn<AuthBridge["finishSignUp"]>(async () => ({ ok: true, user: PAT })),
    resetPassword: vi.fn<AuthBridge["resetPassword"]>(async () => ({ ok: true, user: PAT })),
    changePassword: vi.fn<AuthBridge["changePassword"]>(async () => ({ ok: true, user: PAT })),
    signOut: vi.fn<AuthBridge["signOut"]>(ok),
    signOutEverywhere: vi.fn<AuthBridge["signOutEverywhere"]>(ok),
    status: vi.fn<AuthBridge["status"]>(signedInResult),
  };
  vi.stubGlobal("meetapp", { platform: "darwin", auth });
  return auth;
}

/** Renders `ui` inside a fresh cache and a router that starts at `path` (with optional state). */
export function renderWithApp(ui: ReactNode, options: { path?: string; state?: unknown } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const entry = { pathname: options.path ?? "/", state: options.state };
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
