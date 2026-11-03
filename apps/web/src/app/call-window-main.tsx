// F16's small call windows' entry (call-window.html; design.md section 1, D079): only the window itself,
// with no router, sign-in or backend access. The desktop app tells it what to show.
import "./styles.css";
import "./i18n.ts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CallWindowPage } from "../pages/CallWindowPage/index.ts";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <CallWindowPage />
    </StrictMode>,
  );
}
