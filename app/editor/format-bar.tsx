import { Button, type IconName, IconButton, Menu, SelectionToolbar } from "@wildchild/design-system";
import { useState } from "react";

import type { SimpleMark } from "~/domain/blocks/types";
import { canTurnInto } from "~/editor/commands";
import { type EditorState, getBlock, isCollapsed, type Selection, selectionEnd, selectionStart } from "~/editor/editor-state";
import { hasMark, linkAt } from "~/editor/rich-text";

/** The marks the bar toggles, in its order. The icon catalog has no `code`, so code shows `<>`. */
export const BAR_MARKS: readonly { mark: SimpleMark; label: string; key: string; icon?: IconName }[] = [
  { mark: "bold", label: "Bold", key: "B", icon: "format_bold" },
  { mark: "italic", label: "Italic", key: "I", icon: "format_italic" },
  { mark: "underline", label: "Underline", key: "U", icon: "format_underlined" },
  { mark: "strikethrough", label: "Strikethrough", key: "Shift+S", icon: "format_strikethrough" },
  { mark: "code", label: "Code", key: "E" },
];

/** What the bar shows for a selection: whether Turn into is offered, and which marks (and a link) the whole selection has. */
export type FormatBarState = { turnInto: boolean; pressed: ReadonlySet<SimpleMark>; link: boolean };

/**
 * The bar for an in-block selection, or `null` where it doesn't show: a
 * collapsed selection, the title, and code (which holds plain text).
 */
export function formatBarFor(state: EditorState, selection: Selection): FormatBarState | null {
  if (isCollapsed(selection) || selection.blockId === state.rootId) return null;
  const block = state.blocks[selection.blockId];
  if (!block || block.type === "code") return null;
  const [start, end] = [selectionStart(selection), selectionEnd(selection)];
  const { content } = getBlock(state, block.id);
  return {
    turnInto: canTurnInto(state, block.id),
    pressed: new Set(BAR_MARKS.filter(({ mark }) => hasMark(content, start, end, mark)).map(({ mark }) => mark)),
    link: linkAt(content, start, end) !== undefined,
  };
}

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const shortcut = (key: string) => (isMac() ? `⌘${key.replace("Shift+", "⇧")}` : `Ctrl+${key}`);

/** A type the bar's Turn into offers. */
export type BarType = { value: string; label: string; current: boolean; choose: () => void };

/**
 * The formatting bar over selected text, in the design system's
 * `SelectionToolbar`, which never takes focus: its buttons keep the text's
 * selection.
 */
export function FormatBar({
  bar,
  rect,
  placement,
  typeLabel,
  types,
  onMark,
  onLink,
  onDismiss,
  onTypesClosed,
}: {
  bar: FormatBarState | null;
  rect: DOMRect | null;
  placement: "top" | "bottom";
  typeLabel: string;
  types: () => BarType[];
  onMark: (mark: SimpleMark) => void;
  onLink: () => void;
  onDismiss: () => void;
  /** The type list closed (chosen or not): focus goes back to the text. */
  onTypesClosed: () => void;
}) {
  // While the type list is open the bar is hidden (it would cover the list), and the list hangs from where Turn into was.
  const [typeMenu, setTypeMenu] = useState<{ at: DOMRect; items: BarType[] } | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const closeTypes = () => {
    setTypeMenu(null);
    onTypesClosed();
  };
  return (
    <>
    <SelectionToolbar
      open={bar !== null && rect !== null && typeMenu === null}
      anchorRect={rect}
      ariaLabel="Formatting"
      placement={placement}
      // Choosing from the type menu is a press outside the toolbar: the bar stays until the menu is done.
      onDismiss={() => typeMenu === null && onDismiss()}
    >
      {bar && (
        <>
          {bar.turnInto && (
            <>
              <Button
                size="small"
                variant="text"
                onClick={(event) => setTypeMenu({ at: event.currentTarget.getBoundingClientRect(), items: types() })}
              >
                {typeLabel} ▾
              </Button>
              <SelectionToolbar.Divider />
            </>
          )}
          {BAR_MARKS.map(({ mark, label, key, icon }) => (
            <IconButton
              key={mark}
              ariaLabel={`${label} (${shortcut(key)})`}
              icon={icon}
              size="small"
              pressed={bar.pressed.has(mark)}
              onClick={() => onMark(mark)}
            >
              {icon ? undefined : (
                <span className="format-bar-glyph" aria-hidden="true">
                  {"<>"}
                </span>
              )}
            </IconButton>
          ))}
          <IconButton ariaLabel={`Link (${shortcut("K")})`} icon="link" size="small" pressed={bar.link} onClick={onLink} />
        </>
      )}
    </SelectionToolbar>
    {/* Outside the toolbar, so it outlives it: an invisible anchor where Turn into was. */}
    {typeMenu && (
      <span
        ref={setAnchor}
        aria-hidden="true"
        style={{ position: "fixed", left: typeMenu.at.left, top: typeMenu.at.bottom, width: typeMenu.at.width, height: 0 }}
      />
    )}
    <Menu
      dense
      open={typeMenu !== null && anchor !== null}
      anchorEl={typeMenu ? anchor : null}
      options={(typeMenu?.items ?? []).map(({ value, label, current, choose }) => ({
        value,
        label: `${current ? "✓ " : ""}${label}`,
        onClick: choose,
      }))}
      onClose={(_, reason) => reason !== "itemClick" && closeTypes()}
      onSelect={closeTypes}
    />
    </>
  );
}
