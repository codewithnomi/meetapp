// What the code screen's two buttons do, for each purpose (F01 design.md section 2): Confirm (sign up,
// sign in, or go on to the new password) and Send a new code.
import { useNavigate } from "react-router";
import { authBridge, useAuthAction, type CodeScreenState, type NewPasswordState } from "../../features/auth/index.ts";

export function useCodeActions(state: CodeScreenState) {
  const navigate = useNavigate();
  const confirm = useAuthAction(async (code: string) => {
    if (state.purpose === "signUp") return authBridge().finishSignUp(state.signupId, code);
    if (state.purpose === "signIn") return authBridge().signInWithCode(state.email, code);
    // The reset code is checked together with the new password (one step on the backend).
    const next: NewPasswordState = { email: state.email, code };
    await navigate("/new-password", { state: next });
    return { ok: true as const };
  });
  const resend = useAuthAction(() =>
    state.purpose === "signUp"
      ? authBridge().resendSignUpCode(state.signupId)
      : authBridge().requestCode(state.email, state.purpose === "reset" ? "reset" : "sign-in"),
  );
  return { confirm, resend };
}
