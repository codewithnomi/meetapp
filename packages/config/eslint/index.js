// Shared ESLint flat config for the whole repository (docs/engineering/code-quality.md, frontend.md).
// The root eslint.config.js re-exports this. A rule change here needs code-quality.md changed first.
import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import boundaries from "eslint-plugin-boundaries";
import i18next from "eslint-plugin-i18next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";
import tseslint from "typescript-eslint";
import { noRawColor } from "./no-raw-color.js";

const CODE = ["**/*.{js,mjs,cjs,ts,mts,cts,tsx,jsx}"];
const UNIT_TESTS = ["**/*.test.{ts,tsx,js}", "**/*.spec.{ts,tsx,js}"];
const TESTS = [...UNIT_TESTS, "tests/e2e/**"];
const LEVELS = ["atom", "molecule", "organism", "template", "page"];

/** Hard limits from code-quality.md section 3. */
const hardLimits = {
  files: CODE,
  rules: {
    "max-lines-per-function": ["error", { max: 50, skipBlankLines: false, skipComments: false, IIFEs: true }],
    "max-lines": ["error", { max: 300, skipBlankLines: false, skipComments: false }],
    "max-params": ["error", { max: 4 }],
    "max-depth": ["error", { max: 3 }],
    "sonarjs/cognitive-complexity": ["error", 15],
    "no-console": "error",
    "@typescript-eslint/no-explicit-any": "error",
  },
};

/** Atomic Design: a level may only import lower levels (frontend.md section 2). */
const atomicLevels = {
  files: CODE,
  plugins: { boundaries },
  settings: {
    "boundaries/elements": LEVELS.map((type) => ({ type, pattern: `**/${type}s/*`, capture: ["name"] })),
    "import/resolver": { typescript: { alwaysTryTypes: true }, node: true },
  },
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "allow",
        policies: LEVELS.map((type, index) => ({
          from: { element: { type } },
          disallow: { to: { element: { type: LEVELS.slice(index + 1) } } },
          message: `A ${type} may only import lower Atomic levels, not a {{to.element.type}} (docs/engineering/frontend.md).`,
        })).filter((policy) => policy.disallow.to.element.type.length > 0),
      },
    ],
  },
};

/** Visible text and accessible names must go through translation (AC-F00-16). */
const translations = {
  files: ["**/*.{tsx,jsx}"],
  plugins: { i18next },
  rules: {
    "i18next/no-literal-string": [
      "error",
      {
        mode: "jsx-only",
        "jsx-attributes": {
          include: [
            "aria-label",
            "aria-description",
            "aria-roledescription",
            "aria-valuetext",
            "title",
            "alt",
            "placeholder",
            "label",
          ],
        },
        message: 'Visible text must come from the translation file: use t("…") (docs/engineering/frontend.md).',
      },
    ],
  },
};

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/",
      "**/dist/",
      "**/out/",
      "**/storybook-static/",
      "**/coverage/",
      "tests/fixtures/",
      "**/.turbo/",
    ],
  },
  js.configs.recommended,
  comments.recommended,
  {
    // code-quality.md: a limit may be broken only with a comment explaining why.
    rules: {
      "@eslint-community/eslint-comments/require-description": ["error", { ignore: [] }],
      "@eslint-community/eslint-comments/no-unlimited-disable": "error",
    },
  },
  tseslint.configs.strict,
  {
    files: CODE,
    languageOptions: { globals: { ...globals.node } },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    plugins: { sonarjs, meetapp: { rules: { "no-raw-color": noRawColor } } },
  },
  hardLimits,
  {
    files: CODE,
    ignores: ["packages/design-tokens/**", ...UNIT_TESTS],
    rules: { "meetapp/no-raw-color": "error" },
  },
  {
    files: ["**/*.{tsx,jsx}"],
    ...jsxA11y.flatConfigs.recommended,
    languageOptions: { ...jsxA11y.flatConfigs.recommended.languageOptions, globals: { ...globals.browser } },
  },
  // React: hooks only at the top level, complete effect dependencies.
  { files: ["**/*.{tsx,jsx}"], ...reactHooks.configs.flat["recommended-latest"] },
  atomicLevels,
  translations,
  {
    // Stories and tests show sample content (gallery, test data); it never ships in the app.
    files: ["**/*.stories.tsx", "**/*.test.tsx"],
    rules: { "i18next/no-literal-string": "off" },
  },
  {
    files: TESTS,
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/no-focused-tests": "error",
      "vitest/no-disabled-tests": "error",
      // Vitest's expect(value, message) prints the message when the check fails.
      "vitest/valid-expect": ["error", { maxArgs: 2 }],
      "max-lines": "off",
      "max-lines-per-function": "off",
    },
  },
);
