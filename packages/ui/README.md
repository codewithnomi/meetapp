# @meetapp/ui

The MeetApp design system in React, built exactly from the approved design system (D029) and organised by Atomic Design (`docs/engineering/frontend.md`).

- **Atoms:** Avatar, Badge, Button, Icon (Lucide icons under the design system's names), IconButton, Input, Spinner, Toggle (Radix Switch), Tooltip (Radix).
- **Molecules:** AccentPicker and SegmentedControl (the Settings → Appearance controls), both keyboard radio groups.
- **Styles:** import `@meetapp/ui/styles.css` once. It loads the design tokens, Tailwind with only token classes, and the bundled Figtree and JetBrains Mono fonts (no Google request).
- **Gallery:** `pnpm --filter @meetapp/ui storybook` → http://127.0.0.1:6006. The toolbar switches light/dark and the 8 accent colors. The accessibility panel fails on any violation.
- **Text:** components contain no text of their own. Every label arrives as a prop, already translated.
- **New component:** use `/new-component <level> <Name>`; each gets `X.tsx`, `X.stories.tsx`, `X.test.tsx`, `index.ts`.
- **Test:** `pnpm exec vitest run --project ui` (jsdom + Testing Library). UI tests must end in `.test.tsx`.
