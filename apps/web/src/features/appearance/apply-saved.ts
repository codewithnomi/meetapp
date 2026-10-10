// Imported first by the app's entry: puts the saved theme and accent on <html> before React draws
// anything, so the app never flashes the wrong theme (TC-F00-17). It is a module, not an inline script,
// because the desktop app's security policy blocks inline scripts.
import { applyAppearance, loadAppearance } from "./appearance.ts";

applyAppearance(loadAppearance());
