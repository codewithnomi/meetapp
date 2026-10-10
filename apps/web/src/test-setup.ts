// Adds DOM matchers, cleans up after each test, and loads the translations the screens use.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "./app/i18n.ts";

afterEach(() => cleanup());
