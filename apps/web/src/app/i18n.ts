// Translations (frontend.md rule 5): every visible text comes from locales/en.json. Bundled with the
// app and set up synchronously, so the first screen already has its words.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json" with { type: "json" };

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}

void i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
  initAsync: false,
});
