// Custom rule meetapp/no-raw-color (AC-F00-15): components must use design tokens, never a fixed color.
// Flags hex colors, CSS color functions and fixed Tailwind palette classes inside strings and templates,
// and CSS named colors ("red", fill="white") where a color is expected. currentColor, transparent and
// inherit stay allowed: they are not fixed colors.
import { COLOR_PROPERTIES, CSS_NAMED_COLORS } from "./css-named-colors.js";

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white";
const UTILITIES =
  "bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|decoration|shadow|accent|caret|divide|placeholder|inset-shadow|inset-ring|text-shadow|drop-shadow";

/** One combined pattern: hex colors, CSS color functions, fixed Tailwind palette classes. */
const RAW_COLOR = new RegExp(
  [
    // Six or eight hex digits always count; three or four only with a letter a-f, so "Room #101" passes.
    String.raw`(?<![\w&])#(?:[0-9a-f]{8}|[0-9a-f]{6}|(?=[0-9]*[a-f])[0-9a-f]{3,4})(?![\w-])`,
    String.raw`\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(`,
    String.raw`(?<![\w-])(?:${UTILITIES})-(?:${PALETTE})(?:-\d{2,3})?(?:\/\d{1,3})?(?![\w-])`,
  ].join("|"),
  "gi",
);

/** Attributes whose values are links or ids, where "#abc" is an anchor, not a color. */
const NON_COLOR_ATTRIBUTES = new Set(["href", "to", "id", "htmlFor", "key", "xlinkHref"]);

function isNonColorAttribute(node) {
  let parent = node.parent;
  if (parent?.type === "JSXExpressionContainer") parent = parent.parent;
  return parent?.type === "JSXAttribute" && NON_COLOR_ATTRIBUTES.has(parent.name.name);
}

/** The property or attribute name a string literal is the value of, if any. */
function colorSlotName(node) {
  let parent = node.parent;
  if (parent?.type === "JSXExpressionContainer") parent = parent.parent;
  if (parent?.type === "JSXAttribute") return parent.name.name;
  if (parent?.type === "Property" && parent.value === node) return parent.key.name ?? parent.key.value;
  return undefined;
}

function isNamedColorInColorSlot(node) {
  const slot = colorSlotName(node);
  return slot !== undefined && COLOR_PROPERTIES.has(slot) && CSS_NAMED_COLORS.has(node.value.trim().toLowerCase());
}

/** @type {import("eslint").Rule.RuleModule} */
export const noRawColor = {
  meta: {
    type: "problem",
    docs: { description: "Disallow raw colors; use design tokens (docs/engineering/frontend.md)." },
    schema: [],
    messages: {
      rawColor:
        'Raw color "{{value}}" found. Use a design token instead (a token class such as bg-accent, or var(--color-…)). See docs/engineering/frontend.md.',
    },
  },
  create(context) {
    function check(node, text) {
      for (const match of text.matchAll(RAW_COLOR)) {
        context.report({ node, messageId: "rawColor", data: { value: match[0] } });
      }
    }
    return {
      Literal(node) {
        if (typeof node.value !== "string" || isNonColorAttribute(node)) return;
        if (isNamedColorInColorSlot(node)) context.report({ node, messageId: "rawColor", data: { value: node.value } });
        else check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
      JSXText(node) {
        check(node, node.value);
      },
    };
  },
};
