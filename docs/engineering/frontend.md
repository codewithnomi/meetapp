---
status: draft
updated: 2026-10-09
---

# Frontend Rules (React, Atomic Design)

Applies to desktop (Electron) and web. The mobile app (Flutter, D019) follows the same Atomic Design levels and uses the same design tokens, built as Flutter widgets.

## 0. Source of truth for the look
The approved **MeetApp design system** (https://claude.ai/artifact/K9GV7yg9Y4QkNJ7VgAb3PJ) defines every color, font, spacing step and component. Code copies it exactly (D029). If the code needs something the design system doesn't have, add it to the design system first.

## 1. Atomic Design: what each level means
We build the UI like LEGO: small pieces combine into bigger pieces.

| Level | What it is | MeetApp examples | Allowed to use |
|---|---|---|---|
| **Tokens** | Design values: colors, spacing, fonts, radius, shadows | `color.primary`, `space.4` | nothing |
| **Atoms** | Smallest UI pieces; can't be split further | Button, IconButton, Icon, Avatar, Input, Badge, Spinner, Tooltip, Toggle | tokens |
| **Molecules** | A few atoms working together | MicToggleButton, DeviceSelect, SearchField, ChatMessage, ParticipantBadge, CaptionLine | atoms |
| **Organisms** | Larger self-contained sections | VideoTile, VideoGrid, MeetingControlBar, ChatPanel, TranscriptPanel, ParticipantList, MinutesView, AskAIChat | molecules, atoms |
| **Templates** | Page layouts with empty slots, no real data | MeetingLayout, DashboardLayout, AuthLayout, SettingsLayout | organisms and below |
| **Pages** | Templates filled with real data; the only level that talks to the backend | MeetingPage, HomePage, MeetingHistoryPage, MinutesPage, SettingsPage | everything |

### Hard rules
1. A level may only import from **lower** levels, never the same level's siblings' internals or higher levels. This is checked automatically by a lint rule (`eslint-plugin-boundaries`).
2. **Atoms, molecules, organisms and templates contain no data fetching** and no backend calls. They receive data through props and report actions through callbacks (`onMute`, `onSend`).
3. **Pages** (and page-level hooks) fetch data and hold state.
4. LiveKit-specific code stays inside organisms such as `VideoTile` and page hooks, never in atoms.
5. Every visible text goes through translation (`t("meeting.mute")`); no hard-coded strings. Component font sizes that are not text-style tokens (e.g. 13/14px on buttons) are copied exactly from the design system's component styles. Components never contain text of their own: labels arrive as props, already translated. Stories and tests may use sample text (the lint rule is off only for `*.stories.tsx` and `*.test.tsx`).

## 2. Folder structure
```
packages/ui/src/            ← shared design system (desktop + web)
  (tokens come from packages/design-tokens: tokens.json → tokens.css + Tailwind theme; shared with Flutter later)
  atoms/Button/
    Button.tsx              the component
    Button.stories.tsx      visual documentation (Storybook)
    Button.test.tsx         tests
    index.ts                public export
  molecules/…
  organisms/…
  templates/…
apps/web/src/
  pages/                    MeetingPage/, HomePage/ … (pages + their hooks)
  features/                 page-level logic per feature: meetings/, transcripts/, ask-ai/
  app/                      routing, providers, app setup
```
Create components with the `/new-component` command so every component gets all four files.

## 3. Libraries (proposed, see decisions log)
| Need | Choice | Why |
|---|---|---|
| Styling | **Tailwind CSS** + CSS variables for tokens | Fast to build, consistent; tokens enable light/dark themes |
| Accessible base parts | **Radix UI** primitives | Menus, dialogs and tooltips that work with keyboard and screen readers |
| Server data | **TanStack Query** | Caching, loading and error states handled consistently |
| App state | **Zustand** | Small and simple (e.g. layout, selected devices) |
| Forms | **React Hook Form + Zod** | Validation; Zod schemas are shared with the backend |
| Translations | **i18next** | Many languages, right-to-left (Urdu/Arabic) support |
| Component docs | **Storybook** | Every component documented visually: the living UI documentation |
| Calling UI | **LiveKit React components/hooks** | Used inside our own organisms, styled with our tokens |

## 4. Quality rules
- **Accessibility:** WCAG 2.2 AA. Everything usable with the keyboard; every button has a label; color contrast checked (Storybook a11y addon).
- **Themes (D018):** light, dark and "system" modes plus a user-selectable accent color (default **sky blue**), all via tokens. Components never use a fixed color, only token names like `accent`, `surface`, `text`, so any theme works automatically. Every accent color must pass contrast checks in light and dark mode.
- **States:** every component that shows data has loading, empty and error states.
- **Performance:** 100-person grid renders only visible tiles; heavy pages are lazy-loaded.
- **Testing:** atoms/molecules get unit tests (React Testing Library); organisms get interaction tests; pages get e2e tests (Playwright).
