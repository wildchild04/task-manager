/**
 * The keys Vim mode handles, by group, for the help dialog. Kept next to
 * `vim.ts`: a key added there is listed here.
 */
export type VimKeyGroup = { title: string; keys: readonly (readonly [keys: string, meaning: string])[] };

export const VIM_KEYS: readonly VimKeyGroup[] = [
  {
    title: "Moving (Normal and Visual, with a count: 3w)",
    keys: [
      ["h l", "A character left or right, within the block (also ← →)"],
      ["j k", "A line down or up, keeping the column; stops at images, never enters the title (also ↓ ↑)"],
      ["w b", "The next or previous word's start, into other blocks"],
      ["e", "The next word's end"],
      ["0 ^ $", "The line's start, first non-blank character, last character"],
      ["gg G", "The first or last line of the cursor's block"],
    ],
  },
  {
    title: "Entering Insert",
    keys: [
      ["i a", "Before or after the cursor's character"],
      ["I A", "At the line's first non-blank character, at the block's end"],
      ["o O", "In a new block after or before (a list goes on as a list)"],
      ["Esc", "Back to Normal; an open menu closes first"],
    ],
  },
  {
    title: "Changing (Normal)",
    keys: [
      ["x", "Delete the character (3x: three)"],
      ["d{motion}", "Delete to a motion: dw, de, db, d$, d0, d^"],
      ["c{motion}", "Delete to a motion and enter Insert: cw, c$…"],
      ["y{motion}", "Copy to a motion"],
      ["dd cc yy", "Delete, change or copy the whole block (2dd: two blocks)"],
      ["p P", "Paste after or before (text, or whole blocks)"],
      ["u Ctrl-r", "Undo, redo"],
    ],
  },
  {
    title: "Visual",
    keys: [
      ["v", "Select from the cursor's character; motions extend it, across blocks too"],
      ["d x", "Delete the selection"],
      ["c", "Delete it and enter Insert"],
      ["y", "Copy it (also to the clipboard)"],
      ["Esc v", "Back to Normal"],
    ],
  },
  {
    title: "Leader (Space, then within a second)",
    keys: [
      ["Space /", "The slash menu"],
      ["Space @", "The mention menu"],
      ["Space Esc", "Select the block"],
    ],
  },
  {
    title: "Everywhere",
    keys: [
      ["Ctrl/Cmd", "Shortcuts (bold, links, turn into, select all, undo…) work in every mode"],
      ["?", "This list (in Normal mode)"],
    ],
  },
];
