// The renderer's entry. The saved look is applied FIRST, before any styles or React, so the app never
// flashes the wrong theme (TC-F00-17). It is imported directly, not through features/appearance/index.ts,
// because only its side effect is wanted and it must run before everything else.
import "../features/appearance/apply-saved.ts";
import "./styles.css";
import "./i18n.ts";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
