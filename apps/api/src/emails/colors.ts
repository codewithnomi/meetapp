// Email colors from the approved design tokens (D029), light theme with the default sky accent.
// Mail apps can't read the app's CSS variables, so the values are looked up here instead of typed in.
import tokens from "@meetapp/design-tokens/tokens.json" with { type: "json" };

interface ColorToken {
  name: string;
  value: { light: string };
}

const BY_NAME = new Map((tokens.color.tokens as ColorToken[]).map((token) => [token.name, token.value.light]));

/** A token's light value, following references such as "{accent-sky}". */
function light(name: string): string {
  const value = BY_NAME.get(name);
  if (value === undefined) throw new Error(`Unknown design token ${name}`);
  const reference = /^\{(.+)\}$/.exec(value);
  return reference?.[1] ? light(reference[1]) : value;
}

export const EMAIL_COLORS = {
  ink: light("ink"),
  inkMuted: light("ink-muted"),
  accent: light("accent"),
  onAccent: light("on-accent"),
} as const;
