---
name: new-component
description: Create a new React UI component following Atomic Design, with its story, test and export. Use when a new atom, molecule, organism or template is needed (e.g. "/new-component molecule MicToggleButton").
argument-hint: <atom|molecule|organism|template> <ComponentName>
---

# Create component: $ARGUMENTS

1. Read `docs/engineering/frontend.md`.
2. **Check for reuse first:** search `packages/ui/src/` for an existing component that does the same or nearly the same thing. If one exists, suggest extending it instead and stop unless the owner insists.
3. Confirm the level is right (an atom has no child components; a molecule combines a few atoms; etc.). If the level looks wrong, say why and suggest the right one.
4. Create `packages/ui/src/<level>s/<ComponentName>/`:
   - `<ComponentName>.tsx`: typed props, tokens only, translated text via props or `t()`, accessible (labels, keyboard), no data fetching.
   - `<ComponentName>.stories.tsx`: Storybook stories for every visual state (default, disabled, loading, error, long text, dark theme).
   - `<ComponentName>.test.tsx`: tests for rendering, interactions (callbacks fire) and accessibility (role/label present).
   - `index.ts`: export.
5. Add it to the level's `index.ts`.
6. Run its tests and the typecheck.
7. Tell the owner in one line what was created and where to see it in Storybook.
