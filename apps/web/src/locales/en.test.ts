// TC-F00-38 (en.json part): every t("…") key used in apps/web exists in locales/en.json, so no screen
// ever shows a raw key instead of text. Keys built from a template (t(`a.${x}`)) must match a real key.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "..");
const EN: unknown = JSON.parse(readFileSync(join(SRC, "locales", "en.json"), "utf8"));

/** Every source file of the app (tests and test helpers left out). */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "test-utils" ? [] : sourceFiles(full);
    const isCode = /\.(ts|tsx)$/.test(entry.name);
    const isTest = /\.test\.(ts|tsx)$/.test(entry.name) || entry.name === "test-setup.ts";
    return isCode && !isTest ? [full] : [];
  });
}

/** All text keys in en.json as dot paths, e.g. "settings.appearance.title". */
function leafKeys(node: unknown, prefix = ""): string[] {
  if (typeof node !== "object" || node === null) return [prefix];
  return Object.entries(node).flatMap(([key, value]) => leafKeys(value, prefix ? `${prefix}.${key}` : key));
}

interface Usage {
  file: string;
  key: string;
  isTemplate: boolean;
}

const T_CALL = /\bt\(\s*(["'`])((?:(?!\1)[^\\]|\\.)*)\1/g;

function usages(): Usage[] {
  return sourceFiles(SRC).flatMap((file) =>
    Array.from(readFileSync(file, "utf8").matchAll(T_CALL), (match) => ({
      file: relative(SRC, file),
      key: match[2] ?? "",
      isTemplate: match[1] === "`" && (match[2] ?? "").includes("${"),
    })),
  );
}

/** A template key like `settings.themes.${value}` becomes a pattern with one dot-free part per ${…}. */
function templatePattern(key: string): RegExp {
  const parts = key.split(/\$\{[^}]*\}/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${parts.join("[^.]+")}$`);
}

const KEYS = new Set(leafKeys(EN));
const hasKey = (key: string) => KEYS.has(key) || KEYS.has(`${key}_one`) || KEYS.has(`${key}_other`);

describe("en.json covers every t() key", () => {
  it("TC-F00-38 [AC-F00-16] the scan finds t() calls in the app (the check is not empty)", () => {
    expect(usages().length).toBeGreaterThan(0);
  });

  it("TC-F00-38 [AC-F00-16] the scanner reads double, single and template quotes, and spots a missing key", () => {
    const sample = `t("home.wordmark"); i18n.t('settings.title'); t(\`settings.appearance.themes.\${v}\`); split("x")`;
    const keys = Array.from(sample.matchAll(T_CALL), (match) => match[2]);
    expect(keys).toEqual(["home.wordmark", "settings.title", "settings.appearance.themes.${v}"]);
    expect(hasKey("home.not-a-real-key")).toBe(false);
    expect(templatePattern("settings.appearance.nope.${v}").test("settings.appearance.themes.dark")).toBe(false);
  });

  it("TC-F00-38 [AC-F00-16] every fixed t() key exists in en.json", () => {
    const missing = usages()
      .filter((usage) => !usage.isTemplate && !hasKey(usage.key))
      .map((usage) => `${usage.file}: ${usage.key}`);
    expect(missing).toEqual([]);
  });

  it("TC-F00-38 [AC-F00-16] every template t() key matches at least one key in en.json", () => {
    const missing = usages()
      .filter((usage) => usage.isTemplate && ![...KEYS].some((key) => templatePattern(usage.key).test(key)))
      .map((usage) => `${usage.file}: ${usage.key}`);
    expect(missing).toEqual([]);
  });

  it("TC-F00-38 [AC-F00-16] every text in en.json is a non-empty string", () => {
    const empty = [...KEYS].filter((key) => {
      const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], EN);
      return typeof value !== "string" || value.trim() === "";
    });
    expect(empty).toEqual([]);
  });
});
