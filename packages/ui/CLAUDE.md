# Rules for packages/ui
- Copy the approved design system exactly (props, sizes, states, behavior); if something is missing, add it to the design system first (D029).
- Token classes only (`bg-accent`, `text-ink`, `rounded-full` …). Never a palette class, hex value or named color; lint enforces it.
- A level imports only lower levels, and other components only through their `index.ts` (dependency-cruiser enforces it).
- No data fetching, no app state, no text of their own: data and translated labels arrive as props, actions leave as callbacks.
- Every interactive element uses FOCUS_RING (lib/cx.ts) and works with Tab, Enter and Space. A group of choices (one chosen) uses lib/useRadioGroup.ts: one Tab stop, arrow keys to choose.
- Give each variant exactly one border color; two competing border classes render the wrong one.
- Every component has stories for each state (Normal, Hover, Focused, Disabled, Loading where relevant) and tests next to it.
