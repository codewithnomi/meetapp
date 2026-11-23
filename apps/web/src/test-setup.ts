// Adds DOM matchers, cleans up after each test, and loads the translations the screens use.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "./app/i18n.ts";

afterEach(() => cleanup());

// jsdom has no ResizeObserver; Radix switches (e.g. All day in the schedule form) use one to measure.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
