// The sign-in screens with the real routes and a fake desktop main process (F01 T9): TC-F01-01, 14, 28
// and 73 at screen level (the real desktop window and backend are covered by tests/e2e/desktop).
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAT, installFakeAuth, renderWithApp, type FakeAuth } from "../features/auth/fake-auth.tsx";
import { fakeColorScheme, resetAppearanceDom } from "../test-utils/fakeColorScheme.ts";
import { AppRoutes } from "./router.tsx";

const EMAIL = "pat@example.test";
const PASSWORD = "correct horse battery";
let auth: FakeAuth;

beforeEach(() => {
  resetAppearanceDom();
  fakeColorScheme(false);
  // No backend for the screens' own calls (flags) in these tests.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );
  auth = installFakeAuth(null);
});
afterEach(() => vi.unstubAllGlobals());

const user = () => userEvent.setup();
const heading = (name: string) => screen.findByRole("heading", { level: 1, name });

async function typeCode(digits: string) {
  await user().click(screen.getByRole("textbox", { name: "Digit 1 of 6" }));
  await user().keyboard(digits);
}

async function toPasswordStep() {
  renderWithApp(<AppRoutes />);
  await heading("Sign in to MeetApp");
  await user().type(screen.getByRole("textbox", { name: "Email" }), EMAIL);
  await user().click(screen.getByRole("button", { name: "Continue with email" }));
  await heading("Enter your password");
}

describe("TC-F01-14 [AC-F01-05] [AC-F01-06] sign-in screens", () => {
  it("TC-F01-14 [AC-F01-05] email, then the password step; the right password opens the home screen", async () => {
    await toPasswordStep();
    await user().type(screen.getByLabelText("Password"), PASSWORD);
    auth.status.mockResolvedValue({ ok: true, user: PAT });
    await user().click(screen.getByRole("button", { name: "Sign in" }));
    expect(await heading("MeetApp")).toBeInTheDocument();
    expect(auth.signInWithPassword).toHaveBeenCalledWith(EMAIL, PASSWORD);
  });

  it("TC-F01-14 [AC-F01-05] a wrong password shows the message and stays on the password step", async () => {
    auth.signInWithPassword.mockResolvedValue({ ok: false, code: "INVALID_EMAIL_OR_PASSWORD" });
    await toPasswordStep();
    await user().type(screen.getByLabelText("Password"), "not the password");
    await user().click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is wrong");
    expect(screen.getByRole("heading", { level: 1, name: "Enter your password" })).toBeInTheDocument();
  });

  it("TC-F01-14 [AC-F01-06] Email me a code instead: the code screen signs in with the code", async () => {
    await toPasswordStep();
    await user().click(screen.getByRole("button", { name: "Email me a code instead" }));
    await heading("Sign in with a code");
    expect(auth.requestCode).toHaveBeenCalledWith(EMAIL, "sign-in");
    await typeCode("482913");
    await user().click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(auth.signInWithCode).toHaveBeenCalledWith(EMAIL, "482913"));
  });

  it("TC-F01-14 [AC-F01-05] an incomplete email is refused on the screen, without asking main", async () => {
    renderWithApp(<AppRoutes />);
    await heading("Sign in to MeetApp");
    await user().type(screen.getByRole("textbox", { name: "Email" }), "pat@");
    await user().click(screen.getByRole("button", { name: "Continue with email" }));
    expect(await screen.findByText("Enter a full email address, like aisha@aria.com.")).toBeInTheDocument();
  });
});

describe("TC-F01-01 [AC-F01-01] [AC-F01-26] create an account", () => {
  async function fillForm(password = PASSWORD) {
    renderWithApp(<AppRoutes />, { path: "/create-account" });
    await heading("Create your account");
    await user().type(screen.getByRole("textbox", { name: "Email" }), EMAIL);
    await user().type(screen.getByRole("textbox", { name: "Your name" }), "Pat Lee");
    await user().type(screen.getByLabelText("Password"), password);
  }

  it("TC-F01-01 [AC-F01-01] the form, then the code, then home; the account takes this computer's look", async () => {
    await fillForm();
    await user().click(screen.getByRole("checkbox"));
    await user().click(screen.getByRole("button", { name: "Create account" }));
    await heading("Confirm your email");
    expect(auth.startSignUp).toHaveBeenCalledWith({
      email: EMAIL,
      name: "Pat Lee",
      password: PASSWORD,
      termsAccepted: true,
      theme: "system",
      accent: "sky",
    });
    await typeCode("123456");
    await user().click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(auth.finishSignUp).toHaveBeenCalledWith("s-1", "123456"));
  });

  it("TC-F01-01 [AC-F01-03] a short password and a missing tick are explained; nothing is sent", async () => {
    await fillForm("short");
    await user().click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Use at least 10 characters.")).toBeInTheDocument();
    expect(screen.getByText("Tick the box to continue.")).toBeInTheDocument();
    expect(auth.startSignUp).not.toHaveBeenCalled();
  });

  it("TC-F01-73 [AC-F01-29] a double click sends the sign-up once", async () => {
    let finish: (value: { ok: true; signupId: string }) => void = () => undefined;
    auth.startSignUp.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await fillForm();
    await user().click(screen.getByRole("checkbox"));
    await user().dblClick(screen.getByRole("button", { name: "Create account" }));
    expect(auth.startSignUp).toHaveBeenCalledTimes(1);
    finish({ ok: true, signupId: "s-1" });
    await heading("Confirm your email");
  });
});

describe("TC-F01-28 [AC-F01-09] forgot password", () => {
  it("TC-F01-28 [AC-F01-09] reset code, then a new password twice; saving signs in", async () => {
    await toPasswordStep();
    await user().click(screen.getByRole("button", { name: "Forgot password?" }));
    await heading("Reset your password");
    expect(auth.requestCode).toHaveBeenCalledWith(EMAIL, "reset");
    await typeCode("654321");
    await user().click(screen.getByRole("button", { name: "Confirm" }));
    await heading("Choose a new password");
    await user().type(screen.getByLabelText("New password"), "a brand new password");
    await user().type(screen.getByLabelText("Type it again"), "a different password");
    await user().click(screen.getByRole("button", { name: "Save and sign in" }));
    expect(await screen.findByText("The two passwords don't match.")).toBeInTheDocument();
    await user().clear(screen.getByLabelText("Type it again"));
    await user().type(screen.getByLabelText("Type it again"), "a brand new password");
    await user().click(screen.getByRole("button", { name: "Save and sign in" }));
    await waitFor(() => expect(auth.resetPassword).toHaveBeenCalledWith(EMAIL, "654321", "a brand new password"));
  });
});

describe("TC-F01-73 [AC-F01-29] the backend can't be reached", () => {
  it("TC-F01-73 [AC-F01-29] at start: Can't reach MeetApp, and Retry tries again", async () => {
    auth.status.mockResolvedValueOnce({ ok: false, code: "NETWORK_ERROR" });
    renderWithApp(<AppRoutes />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach MeetApp. Check your connection.");
    await user().click(screen.getByRole("button", { name: "Retry" }));
    expect(await heading("Sign in to MeetApp")).toBeInTheDocument();
  });

  it("TC-F01-73 [AC-F01-29] while signing in: the message with Retry, which sends again", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ ok: false, code: "NETWORK_ERROR" });
    await toPasswordStep();
    await user().type(screen.getByLabelText("Password"), PASSWORD);
    await user().click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach MeetApp");
    await user().click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(auth.signInWithPassword).toHaveBeenCalledTimes(2));
  });
});

describe("TC-F01-15 [AC-F01-07] the terms gate", () => {
  it("TC-F01-15 [AC-F01-07] a first Google/Microsoft user sees only Terms until they accept", async () => {
    auth.status.mockResolvedValue({ ok: true, user: { ...PAT, termsAccepted: false } });
    const accepted = vi.fn(async () => Response.json({ user: PAT }));
    vi.stubGlobal("fetch", accepted);
    renderWithApp(<AppRoutes />, { path: "/settings" });
    await heading("Before you start");
    await user().click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Tick the box to continue.")).toBeInTheDocument();
    await user().click(screen.getByRole("checkbox"));
    // From now on the backend knows the terms are accepted.
    auth.status.mockResolvedValue({ ok: true, user: PAT });
    await user().click(screen.getByRole("button", { name: "Continue" }));
    // Once accepted, the person lands where they were going.
    expect(await heading("Settings")).toBeInTheDocument();
    expect(accepted).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/me\/terms$/),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
