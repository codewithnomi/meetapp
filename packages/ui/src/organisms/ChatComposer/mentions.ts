// @mentions in the message box (F14 AC-F14-22), on TipTap's Mention extension: typing "@" and a name
// shows the chat's members; arrows move, Enter or Tab picks, Escape closes. The list is drawn by the
// composer (MentionList); this file links the editor to it.
import Mention from "@tiptap/extension-mention";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";

export interface MentionPerson {
  id: string;
  name: string;
}

/** What the composer shows while a mention is typed. */
export interface MentionMenu {
  people: MentionPerson[];
  active: number;
  pick: (person: MentionPerson) => void;
}

export interface MentionBridge {
  /** The chat's members matching what was typed after "@". */
  search: { current: (query: string) => MentionPerson[] };
  show: (menu: MentionMenu | undefined) => void;
}

const MAX_SHOWN = 8;

function menuOf(props: SuggestionProps<MentionPerson>, active: number): MentionMenu {
  return { people: props.items, active, pick: (person) => props.command({ id: person.id, label: person.name }) };
}

/** Arrow keys move, Enter or Tab picks; returns whether the key was used. */
function onKey(state: { props: SuggestionProps<MentionPerson> | undefined; active: number }, key: string) {
  const items = state.props?.items ?? [];
  if (!state.props || items.length === 0) return false;
  if (key === "ArrowDown") state.active = (state.active + 1) % items.length;
  else if (key === "ArrowUp") state.active = (state.active - 1 + items.length) % items.length;
  else if (key === "Enter" || key === "Tab") {
    const person = items[state.active];
    if (person) state.props.command({ id: person.id, label: person.name });
    return true;
  } else return false;
  return true;
}

export function mentionExtension(bridge: MentionBridge) {
  return Mention.configure({
    HTMLAttributes: { class: "font-semibold text-accent-text" },
    renderText: ({ node }) => `@${String(node.attrs["label"] ?? "")}`,
    suggestion: {
      char: "@",
      items: ({ query }) => bridge.search.current(query).slice(0, MAX_SHOWN),
      render: () => {
        const state: { props: SuggestionProps<MentionPerson> | undefined; active: number } = {
          props: undefined,
          active: 0,
        };
        const show = () => bridge.show(state.props ? menuOf(state.props, state.active) : undefined);
        return {
          onStart: (props) => {
            state.props = props;
            state.active = 0;
            show();
          },
          onUpdate: (props) => {
            state.props = props;
            state.active = Math.min(state.active, Math.max(0, props.items.length - 1));
            show();
          },
          onKeyDown: ({ event }: SuggestionKeyDownProps) => {
            if (event.key === "Escape") {
              state.props = undefined;
              show();
              return true;
            }
            const used = onKey(state, event.key);
            show();
            return used;
          },
          onExit: () => {
            state.props = undefined;
            show();
          },
        };
      },
    },
  });
}
