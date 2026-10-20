import { Button, HoverCard, IconButton, Menu } from "@wildchild/design-system";
import { type CSSProperties, useState } from "react";

import type { SimpleMark } from "~/domain/blocks/types";
import { canTurnInto } from "~/editor/commands";
import { type EditorState, getBlock, isCollapsed, type Selection, selectionEnd, selectionStart } from "~/editor/editor-state";
import { hasMark, linkAt } from "~/editor/rich-text";

/** The marks the bar toggles, in its order, with the glyph standing in for an icon until the design system has them. */
export const BAR_MARKS: readonly { mark: SimpleMark; label: string; key: string; glyph: string; style?: CSSProperties }[] = [
  { mark: "bold", label: "Bold", key: "B", glyph: "B", style: { fontWeight: 700 } },
  { mark: "italic", label: "Italic", key: "I", glyph: "I", style: { fontStyle: "italic", fontFamily: "serif" } },
  { mark: "underline", label: "Underline", key: "U", glyph: "U", style: { textDecoration: "underline" } },
  { mark: "strikethrough", label: "Strikethrough", key: "Shift+S", glyph: "S", style: { textDecoration: "line-through" } },
  { mark: "code", label: "Code", key: "E", glyph: "<>", style: { fontFamily: "monospace", fontSize: "0.8em" } },
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

/** A chain link, until the design system's icon catalog has `link` (an emoji isn't drawn everywhere). */
const LINK_GLYPH = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const shortcut = (key: string) => (isMac() ? `⌘${key.replace("Shift+", "⇧")}` : `Ctrl+${key}`);

/** A type the bar's Turn into offers. */
export type BarType = { value: string; label: string; current: boolean; choose: () => void };

/**
 * The formatting bar over selected text, in a `HoverCard` (which never takes
 * focus) until the design system has a selection toolbar. Its buttons keep the
 * text's selection: they don't take the press.
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
  placement: "top-start" | "bottom-start";
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
    <HoverCard
      open={bar !== null && rect !== null && typeMenu === null}
      anchorRect={rect}
      ariaLabel="Formatting"
      placement={placement}
      // Choosing from the type menu is a press outside the card: the bar stays until the menu is done.
      onDismiss={() => typeMenu === null && onDismiss()}
    >
      {bar && (
        <div className="format-bar" role="toolbar" aria-label="Formatting" onMouseDown={(event) => event.preventDefault()}>
          {bar.turnInto && (
            <>
              <Button
                size="small"
                variant="text"
                onClick={(event) => setTypeMenu({ at: event.currentTarget.getBoundingClientRect(), items: types() })}
              >
                {typeLabel} ▾
              </Button>
              <span className="format-bar-divider" aria-hidden="true" />
            </>
          )}
          {BAR_MARKS.map(({ mark, label, key, glyph, style }) => (
            <IconButton key={mark} ariaLabel={`${label} (${shortcut(key)})`} size="small" pressed={bar.pressed.has(mark)} onClick={() => onMark(mark)}>
              <span className="format-bar-glyph" style={style} aria-hidden="true">
                {glyph}
              </span>
            </IconButton>
          ))}
          <IconButton ariaLabel={`Link (${shortcut("K")})`} size="small" pressed={bar.link} onClick={onLink}>
            {LINK_GLYPH}
          </IconButton>
        </div>
      )}
    </HoverCard>
    {/* Outside the card, so it outlives the card: an invisible anchor where Turn into was. */}
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
