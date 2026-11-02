# @meetapp/ui

## What it is
The MeetApp design system in React, built exactly from the approved design system (D029) and organised by Atomic Design (`docs/engineering/frontend.md`).

- **Atoms:** ActionMenu (the ⋯ menu), Avatar, Badge, Button, Icon (Lucide icons under the design system's names), IconButton, Input, LevelMeter (microphone level), Spinner, Toggle (Radix Switch), Tooltip (Radix); F03: ReactionChip, FileChip, Sticker; F14: StatusDot.
- **Molecules:** AccentPicker and SegmentedControl (the Settings → Appearance controls, keyboard radio groups), AvatarUpload, CodeInput, DeviceSelect, Dialog (Radix), InviteForm, JoinLinkCard, LobbyRow, MemberRow, MessageCard, Notice, ParticipantRow, RequestRow, SidePanel; F03: MessageBody (our own message renderer, never HTML), MessageActions, ReplyQuote, AttachmentCard, SystemNote, PinnedBar, DropArea, EmojiPicker, GifPicker, GifImage, StickerPicker, PollCard; F14: ChatListItem, ChatRequestCard, HistoryChoice, PeoplePicker, SeenMark, TypingIndicator; F15: CallNote, BackgroundPicker, RingtonePicker, OtherDeviceBar.
- **Organisms:** WorkspaceSwitcher (Radix menu); F02: VideoTile, ControlBar, Gallery (16 a page or speaker view, sized to fit the window), ParticipantPanel, MeetingInfoPanel, MeetingOptionsForm, DevicePanel, SharePicker; F03: ChatMessage, ChatPanel, ChatComposer (rich text with TipTap), PollCreator, ExpressionPicker (emoji, GIFs and stickers with tabs, as in Teams); F14: ChatList, ConversationHeader, GroupDetails, NavRail (the side menu that folds to icons); F15: IncomingCall.
- **Templates:** AppLayout (side menu and screen), AuthLayout (the sign-in screens), MeetingLayout (the meeting screen: fits the window, control bar always visible); F15: CallingScreen.
- **Styles:** import `@meetapp/ui/styles.css` once. It loads the design tokens, Tailwind with only token classes, and the bundled Figtree and JetBrains Mono fonts (no Google request).
- **Text:** components contain no text of their own. Every label arrives as a prop, already translated.
- **New component:** use `/new-component <level> <Name>`; each gets `X.tsx`, `X.stories.tsx`, `X.test.tsx`, `index.ts`.

## Run it
The gallery: `pnpm --filter @meetapp/ui storybook` → http://127.0.0.1:6006. The toolbar switches light/dark and the 8 accent colors. The accessibility panel fails on any violation.

## Test it
- Unit tests: `pnpm exec vitest run --project ui` (jsdom + Testing Library), also part of `pnpm test`. UI tests must end in `.test.tsx`.
- Screenshots + accessibility: `pnpm test:visual` compares every story in light and dark with its approved picture and runs axe (needs Docker). After an intended look change, `pnpm test:visual:update` makes new pictures; review them before committing. On failure, `pnpm exec playwright show-report tests/e2e/gallery/playwright-report` shows before, after and the difference.
