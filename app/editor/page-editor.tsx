import {
  Alert,
  Button,
  createAppTheme,
  Dialog,
  HoverCard,
  InlineCommandMenu,
  Stack,
  TextField,
  Typography,
} from "@wildchild/design-system";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useBlocker, useNavigate, useRevalidator } from "react-router";

import type { Operation } from "~/domain/blocks/types";
import { behaviorOf, matchSlashCommands, type SlashCommand } from "~/editor/block-types";
import { Editor } from "~/editor/editor";
import { caret, caretOrder, type EditorState, getBlock, isCollapsed, type Selection, stateFromTree } from "~/editor/editor-state";
import type { CommentBlockInput } from "~/domain/comments/types";
import { linkAt, linkRangeAt, plain } from "~/editor/rich-text";
import { type SaveStatus, SaveQueue, type SendResult } from "~/editor/save-queue";
import { verticalNeighbour } from "~/editor/tables";

import { SuggestionsContext } from "../blocks/block-view";
import { MentionTargetsContext } from "../blocks/rich-text";
import type { MentionTargets } from "../blocks/view-model";
import type { EditablePage } from "../lib/page-edit.server";
import { useThemeMode } from "../theme-mode";
import {
  caretOnEdgeLine,
  caretRect,
  offsetOf,
  editableOf,
  offsetAtX,
  readSelection,
  renderRichText,
  textOf,
  writeSelection,
} from "./dom-caret";
import { EditableText, EditorBlocks } from "./editor-blocks";
import { withBase, withoutBase } from "../lib/base-path";

const SLASH_MENU_ID = "slash-menu";

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "Saved",
  pending: "Saving…",
  saving: "Saving…",
  retrying: "Couldn't save, retrying…",
  failed: "Couldn't save",
};

/** Sends one batch to the edit endpoint. Refusals don't retry; network problems do. */
async function sendBatch(page: EditablePage, batch: Operation[]): Promise<SendResult & { version?: string }> {
  try {
    const response = await fetch(withBase("/api/edits"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surface: page.surface, id: page.id, batch }),
    });
    if (response.status === 400 || response.status === 422) {
      const body = (await response.json()) as { message?: string };
      return { ok: false, retry: false, message: body.message ?? "The edit was refused" };
    }
    if (!response.ok) return { ok: false, retry: true };
    const body = (await response.json()) as { version: string };
    return { ok: true, version: body.version };
  } catch {
    return { ok: false, retry: true };
  }
}

/**
 * The open inline menu: the slash menu (`/`, block commands) or the mention menu
 * (`@`, pages). Where its trigger is, where to show it, the highlighted row, and
 * the page of results (with the filter it's for).
 */
type SlashMenu = {
  kind: "command" | "page";
  blockId: string;
  start: number;
  anchor: DOMRect;
  active: string | null;
  page: number;
  query: string;
};

const TRIGGERS = { command: "/", page: "@" } as const;

/** How many commands the slash menu shows per page. */
const SLASH_PAGE_SIZE = 5;
const SLASH_NEXT_PAGE = "next-page";

/** A row of the inline menu: a command, a page to mention, or the row that turns the page. */
type SlashItem = { value: string; label: string; description?: string; command?: SlashCommand; page?: PageMatch };

/**
 * The rows of the slash menu's current page, or `null` when the menu should
 * close. A changed filter starts again from the first page.
 */
/** The text typed after the menu's trigger, or `null` when the caret has left it (the menu should close). */
function menuQuery(editor: Editor, menu: SlashMenu): string | null {
  const block = editor.state.blocks[menu.blockId];
  const { selection } = editor;
  if (!block || selection.blockId !== menu.blockId || selection.focus <= menu.start) return null;
  const value = plain(block.content);
  if (value[menu.start] !== TRIGGERS[menu.kind]) return null;
  return value.slice(menu.start + 1, selection.focus);
}

function slashMatches(
  editor: Editor,
  menu: SlashMenu,
  /** For the mention menu: the pages found for the current query, or `null` while searching. */
  found: readonly PageMatch[] | null = null,
): { query: string; commands: SlashItem[]; page: number; pages: number } | null {
  const query = menuQuery(editor, menu);
  if (query === null) return null;
  const all: SlashItem[] =
    menu.kind === "command"
      ? matchSlashCommands(query).map((command) => ({
          value: command.value,
          label: command.label,
          description: command.description,
          command,
        }))
      : (found ?? []).map((page) => ({ value: page.id, label: page.title, description: page.place, page }));
  const searching = menu.kind === "page" && found === null;
  if (all.length === 0 && !searching && query.endsWith(" ")) return null;
  const matches = all;
  const rows = (list: SlashItem[]) => list;
  const pages = Math.max(1, Math.ceil(matches.length / SLASH_PAGE_SIZE));
  const page = query === menu.query ? Math.min(menu.page, pages - 1) : 0;
  const shown = rows(matches.slice(page * SLASH_PAGE_SIZE, (page + 1) * SLASH_PAGE_SIZE));
  if (pages === 1) return { query, commands: shown, page, pages };
  const pager = { value: SLASH_NEXT_PAGE, label: `Page ${page + 1} of ${pages}`, description: "Tab next · Shift+Tab back" };
  return { query, commands: [pager, ...shown], page, pages };
}

/** The first command among a page's rows (the page row comes before them). */
const firstCommand = (items: readonly SlashItem[]) => items.find((item) => item.command || item.page)?.value ?? null;

/** The menu turned `step` pages (wrapping around), with its first command highlighted. */
function turnPage(editor: Editor, menu: SlashMenu, step: number, found: readonly PageMatch[] | null): SlashMenu {
  const matches = slashMatches(editor, menu, found);
  if (!matches || matches.pages === 1) return menu;
  const page = (matches.page + step + matches.pages) % matches.pages;
  const turned = { ...menu, page, query: matches.query };
  return { ...turned, active: firstCommand(slashMatches(editor, turned, found)?.commands ?? []) };
}

/** A URL as typed, made absolute: "google.com" becomes "https://google.com"; app paths and other schemes are kept. */
export function normalizeHref(value: string): string {
  const href = value.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("/") || href.startsWith("#")) return href;
  return `https://${href}`;
}

/** A draft's blocks as a comment's content: the root's children, nested. */
export function draftBlocks(state: EditorState): CommentBlockInput[] {
  const toInput = (id: string): CommentBlockInput => {
    const { type, props, content, children } = state.blocks[id]!;
    return { id, type, props, content, ...(children.length > 0 ? { children: children.map(toInput) } : {}) };
  };
  return state.blocks[state.rootId]!.children.map(toInput);
}

/** Links to a page or task of the app. */
const APP_LINK = /^\/(pages|tasks)\/[^/?#]+$/;

/** A page or task to mention or link: the page a mention points at, and the link it opens. */
type PageMatch = { id: string; title: string; place: string; href: string };

/** Pages matching `query`, fetched as the user types (debounced; stale answers are dropped). */
function usePageSearch(query: string | null): PageMatch[] | null {
  const [pages, setPages] = useState<PageMatch[] | null>(null);
  useEffect(() => {
    if (query === null) return setPages(null);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(withBase(`/api/pages?q=${encodeURIComponent(query)}`), { signal: controller.signal })
        .then((response) => response.json() as Promise<{ pages: PageMatch[] }>)
        .then((body) => setPages(body.pages))
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return pages;
}

/** A link being previewed: its element and whole range in its block, where to show the card, and where it goes. */
type LinkCard = {
  element: HTMLAnchorElement;
  blockId: string;
  start: number;
  end: number;
  href: string;
  rect: DOMRect;
  label: string;
};

/** Waits before opening a link card and before closing it, so the pointer can travel from the link onto the card. */
function hoverTimers(openMs = 400, closeMs = 200) {
  let opening: ReturnType<typeof setTimeout> | undefined;
  let closing: ReturnType<typeof setTimeout> | undefined;
  return {
    open(run: () => void) {
      clearTimeout(opening);
      opening = setTimeout(run, openMs);
    },
    close(run: () => void) {
      clearTimeout(closing);
      closing = setTimeout(run, closeMs);
    },
    cancelOpen: () => clearTimeout(opening),
    cancelClose: () => clearTimeout(closing),
  };
}

/** How many pages the link dialog suggests at a time. */
const PAGE_SUGGESTIONS = 5;

/**
 * Asks for a link's URL; an empty URL removes the link. Typing `@` lists the
 * workspace's pages instead: choosing one links to it and saves at once.
 */
function LinkDialog({ initial, onDone }: { initial: string; onDone: (href: string | null | undefined) => void }) {
  const [href, setHref] = useState(initial);
  const [active, setActive] = useState(0);
  // A link to an app page or task shows as "@Title", with it highlighted among the suggestions.
  const [linkedId, setLinkedId] = useState<string | null>(null);
  useEffect(() => {
    if (!APP_LINK.test(initial)) return;
    fetch(withBase(`/api/pages?href=${encodeURIComponent(initial)}`))
      .then((response) => response.json() as Promise<{ pages: PageMatch[] }>)
      .then(({ pages }) => {
        const page = pages[0];
        if (!page) return;
        setLinkedId(page.id);
        setHref((current) => (current === initial ? `@${page.title}` : current));
      })
      .catch(() => {});
  }, [initial]);
  const field = useRef<HTMLDivElement>(null);
  // The dialog moves focus into itself when it opens; focus the field just after.
  useEffect(() => {
    const timer = setTimeout(() => field.current?.querySelector("input")?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  const query = href.startsWith("@") ? href.slice(1) : null;
  const pages = usePageSearch(query)?.slice(0, PAGE_SUGGESTIONS) ?? [];
  const suggesting = query !== null;
  useEffect(() => {
    const linked = pages.findIndex((page) => page.id === linkedId);
    setActive(linked >= 0 ? linked : 0);
    // Re-highlight when the results change (a new query, or the linked page arriving).
  }, [query, pages.map((page) => page.id).join(","), linkedId]);

  const choose = (page: PageMatch) => onDone(page.href);
  const save = () => {
    if (suggesting) {
      const page = pages[active];
      if (page) choose(page);
      return;
    }
    onDone(href.trim() ? normalizeHref(href) : null);
  };
  // The suggestions sit under the field; measured once when they open (a new rect every render would re-place the menu forever).
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    setAnchor(suggesting ? (field.current?.querySelector("input")?.getBoundingClientRect() ?? null) : null);
  }, [suggesting]);

  return (
    <Dialog
      open
      title="Link"
      onClose={() => onDone(undefined)}
      maxWidth="sm"
      fullWidth
      cancelAction={{ label: "Cancel", onClick: () => onDone(undefined) }}
      confirmAction={{
        label: suggesting ? "Link to page" : href.trim() ? "Save link" : "Remove link",
        onClick: save,
        disabled: suggesting && pages.length === 0,
      }}
    >
      <TextField
        ref={field}
        label="URL or @page"
        fullWidth
        value={href}
        onChange={(event) => setHref(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          } else if (suggesting && (event.key === "ArrowDown" || event.key === "ArrowUp") && pages.length > 0) {
            event.preventDefault();
            setActive((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + pages.length) % pages.length);
          }
        }}
        placeholder="https://"
        helperText={
          suggesting
            ? "Choose a page with ↑ ↓ and Enter."
            : "Enter to save. Type @ to link to a page. Leave empty to remove the link."
        }
      />
      <InlineCommandMenu
        open={suggesting}
        anchorRect={anchor}
        ariaLabel="Pages"
        options={pages.map((page) => ({ value: page.id, label: page.title, description: page.place }))}
        activeValue={pages[active]?.id ?? null}
        onActiveValueChange={(id) =>
          setActive(
            Math.max(
              0,
              pages.findIndex((page) => page.id === id),
            ),
          )
        }
        onSelect={(id) => {
          const page = pages.find((p) => p.id === id);
          if (page) choose(page);
        }}
        emptyText="No page matches"
      />
    </Dialog>
  );
}

/**
 * Edits one page's title and blocks. Every edit is applied at once and saved
 * in the background; the page's server data is only re-read when it changed
 * elsewhere and nothing is waiting to be saved.
 */
export function PageEditor({
  page,
  titleVariant = "h1",
  afterTitle,
  statusSlot,
  draft,
  emptyText = "Empty page. Click to start writing.",
  hideBody = false,
}: {
  page: EditablePage;
  titleVariant?: "h1" | "h2";
  /** Shown between the title and the blocks (a task's state and actions). */
  afterTitle?: ReactNode;
  /** Where to show the saving indicator; at the top right of the editor when not given. */
  statusSlot?: HTMLElement | null;
  /** A draft (a new comment): nothing is saved; the content goes to `onChange`, and Cmd/Ctrl+Enter calls `onSubmit`. */
  draft?: { onChange: (blocks: CommentBlockInput[]) => void; onSubmit: () => void };
  /** What an empty page says. */
  emptyText?: string;
  /** Hides the blocks (another tab is open) without unmounting, so unsaved edits and undo history survive. */
  hideBody?: boolean;
}) {
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const rootRef = useRef<HTMLDivElement>(null);
  // Links inside editable text are plain elements; they take the design system's link colour from the theme.
  const { mode } = useThemeMode();
  const linkColor = useMemo(() => createAppTheme(mode).palette.primary.main, [mode]);
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const knownVersion = useRef(page.version);
  const restoreSelection = useRef(false);
  const composing = useRef(false);
  const goalX = useRef<number | null>(null);
  const applySlashRef = useRef<((item: SlashItem) => void) | null>(null);
  // Titles of mentioned pages: from the server, plus pages mentioned since it loaded.
  const [mentionTargets, setMentionTargets] = useState<MentionTargets>(page.mentions);
  useEffect(() => setMentionTargets((targets) => ({ ...targets, ...page.mentions })), [page.mentions]);
  // The card shown for a hovered link, and the timers that open and close it.
  const [linkCard, setLinkCardState] = useState<LinkCard | null>(null);
  const linkCardRef = useRef<LinkCard | null>(null);
  const setLinkCard = useCallback((card: LinkCard | null) => {
    linkCardRef.current = card;
    setLinkCardState(card);
  }, []);
  const cardTimers = useMemo(() => hoverTimers(), []);
  const pageNames = useMemo(() => new Map<string, string>(), []);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [linkFor, setLinkFor] = useState<{ selection: Selection; href: string } | null>(null);
  // While a suggestion decision is on its way; then what it did, with Undo until the next edit.
  const [deciding, setDeciding] = useState(false);
  const [decided, setDecided] = useState<{ message: string; undo?: string; failed?: boolean } | null>(null);
  // The open slash menu: where its `/` is, where to show it, and the highlighted command.
  const [slash, setSlashState] = useState<SlashMenu | null>(null);
  const slashRef = useRef<SlashMenu | null>(null);
  const setSlash = useCallback((next: SlashMenu | null) => {
    slashRef.current = next;
    setSlashState(next);
  }, []);

  const { editor, queue } = useMemo(() => {
    let editor: Editor;
    const queue = new SaveQueue({
      send: async (batch) => {
        const result = await sendBatch(page, batch);
        if (result.ok && result.version) {
          knownVersion.current = result.version;
          // A new title shows in the navigation, lists and breadcrumbs.
          if (batch.some((op) => op.op === "update" && op.id === editor.state.rootId)) void revalidator.revalidate();
        }
        return result;
      },
      onStatus: setStatus,
      onRejected: (message) => {
        setError(`${message}. The page was reloaded.`);
        knownVersion.current = "";
        void revalidator.revalidate();
      },
    });
    editor = new Editor(stateFromTree(page.tree), {
      // A draft isn't saved: its content goes to the caller instead.
      onOps: (ops) => {
        // An edit ends the chance to undo the last suggestion decision.
        setDecided(null);
        if (draftRef.current) draftRef.current.onChange(draftBlocks(editor.state));
        else queue.enqueue(ops);
      },
    });
    return { editor, queue };
    // One editor per page; newer content from the loader is applied below.
  }, [page.surface, page.id]);

  useEffect(() => () => queue.dispose(), [queue]);

  // Pages for the mention menu, searched as the text after `@` changes.
  const found = usePageSearch(slash?.kind === "page" ? (menuQuery(editor, slash) ?? null) : null);
  const foundRef = useRef(found);
  foundRef.current = found;
  // When results arrive, highlight the first page unless the highlighted one is still there.
  useEffect(() => {
    const menu = slashRef.current;
    if (menu?.kind !== "page") return;
    const rows = slashMatches(editor, menu, found)?.commands ?? [];
    if (!rows.some((row) => row.value === menu.active)) setSlash({ ...menu, active: firstCommand(rows) });
  }, [found, editor, setSlash]);

  /** Opens the card for a link element: its whole range in the block, its rectangle and where it goes. */
  const showLinkCard = useCallback(
    (link: HTMLAnchorElement) => {
      const block = link.closest<HTMLElement>("[data-block-id]");
      if (!block || !link.isConnected) return;
      const blockId = block.dataset.blockId!;
      const range = linkRangeAt(getBlock(editor.state, blockId).content, offsetOf(block, link, 0));
      if (!range) return;
      const card: LinkCard = {
        element: link,
        blockId,
        ...range,
        rect: link.getBoundingClientRect(),
        label: withoutBase(link.getAttribute("href") ?? link.href),
      };
      // Links to app pages and tasks show their title and place, looked up once.
      const path = withoutBase(link.pathname);
      const appPath = link.origin === window.location.origin && APP_LINK.test(path) ? path : undefined;
      if (link.origin === window.location.origin) card.label = appPath ? (pageNames.get(appPath) ?? "…") : path;
      setLinkCard(card);
      if (appPath && !pageNames.has(appPath)) {
        fetch(withBase(`/api/pages?href=${encodeURIComponent(appPath)}`))
          .then((response) => response.json() as Promise<{ pages: PageMatch[] }>)
          .then(({ pages }) => {
            const page = pages[0];
            const name = page ? `${page.title} · ${page.place}` : "A page or task that no longer exists";
            pageNames.set(appPath, name);
            if (linkCardRef.current?.element === link) setLinkCard({ ...linkCardRef.current, label: name });
          })
          .catch(() => {});
      }
    },
    [editor, pageNames, setLinkCard],
  );

  // Content changed elsewhere (e.g. a task's return): take it when nothing is waiting to be saved.
  useEffect(() => {
    if (page.version !== knownVersion.current && !queue.dirty) {
      knownVersion.current = page.version;
      editor.reset(stateFromTree(page.tree));
    }
  }, [page.version, page.tree, editor, queue]);

  useSyncExternalStore(
    useCallback((listener) => editor.subscribe(listener), [editor]),
    () => editor.revision,
    () => editor.revision,
  );

  // After an edit, put the caret where the editor says (block content is drawn first, in child effects).
  useLayoutEffect(() => {
    if (!restoreSelection.current || !rootRef.current) return;
    restoreSelection.current = false;
    writeSelection(rootRef.current, editor.selection);
  });

  // ----- Suggestions -----

  /** Sends a decision once every edit is saved, then takes the page as the server has it. */
  const sendDecision = useCallback(
    async (body: Record<string, string>) => {
      setDeciding(true);
      queue.flush();
      await queue.idle();
      let result: { ok: boolean; message: string; undo?: string };
      try {
        const response = await fetch(withBase("/api/suggestions"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        result = (await response.json()) as typeof result;
      } catch {
        result = { ok: false, message: "The server couldn't be reached; try again" };
      }
      knownVersion.current = "";
      await revalidator.revalidate();
      setDeciding(false);
      setDecided(
        result.ok
          ? { message: result.message, ...(result.undo ? { undo: result.undo } : {}) }
          : { message: result.message, failed: true },
      );
    },
    [queue, revalidator],
  );
  const suggestions = useMemo(() => {
    const views = Object.values(page.suggestions);
    return {
      views,
      byId: page.suggestions,
      removing: new Set(views.flatMap((s) => (s.targetId ? [s.targetId] : []))),
      decide: (intent: "approve" | "reject", id: string) => void sendDecision({ intent, id }),
    };
  }, [page.suggestions, sendDecision]);

  // ----- Leaving with unsaved edits -----

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => queue.dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    queue.flush();
    if (status === "saved") blocker.proceed();
  }, [blocker, status, queue]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!queue.dirty) return;
      queue.flush();
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [queue]);

  // ----- Input -----

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const sync = (): Selection | null => {
      const selection = readSelection();
      if (selection && root.contains(editableOf(root, selection.blockId))) editor.setSelection(selection);
      return selection;
    };
    const edited = () => {
      restoreSelection.current = true;
      goalX.current = null;
    };

    /** Keeps the slash menu in step with the text: closes it, or keeps its highlight on a match. */
    const refreshSlash = () => {
      const menu = slashRef.current;
      if (!menu) return;
      const matches = slashMatches(editor, menu, foundRef.current);
      if (!matches) return setSlash(null);
      const active = matches.commands.some((c) => c.value === menu.active) ? menu.active : firstCommand(matches.commands);
      if (active !== menu.active || matches.page !== menu.page || matches.query !== menu.query) {
        setSlash({ ...menu, active, page: matches.page, query: matches.query });
      }
    };

    /** Applies a command, or for the page row turns to the next page. */
    const applySlash = (item: SlashItem) => {
      const menu = slashRef.current;
      if (!menu) return;
      if (item.page) {
        const { id, title, href } = item.page;
        setSlash(null);
        setMentionTargets((targets) => ({ ...targets, [id]: { title, href } }));
        editor.mention(menu.start, id);
        edited();
        return;
      }
      if (!item.command) {
        setSlash(turnPage(editor, menu, 1, foundRef.current));
        return;
      }
      setSlash(null);
      editor.slash(menu.start, item.command);
      edited();
    };

    /**
     * Opens the inline menu for a `/` (commands) or `@` (pages) just typed at
     * `start`, if it's at the start of a text block or after a space.
     */
    const openMenuAt = (blockId: string, start: number, anchor: DOMRect | null) => {
      const block = editor.state.blocks[blockId];
      if (!block || block.id === editor.state.rootId || !behaviorOf(block.type).text) return;
      const text = plain(block.content);
      const trigger = text[start];
      const previous = text[start - 1];
      if ((trigger !== "/" && trigger !== "@") || (previous !== undefined && !/\s/.test(previous))) return;
      // Code is plain text: no menus. A table cell can mention pages but not change type.
      if (block.type === "code" || (block.type === "table_cell" && trigger === "/")) return;
      setSlash({
        kind: trigger === "/" ? "command" : "page",
        blockId,
        start,
        anchor: anchor ?? caretRect() ?? editableOf(root, blockId)!.getBoundingClientRect(),
        active: trigger === "/" ? "text" : null,
        page: 0,
        query: "",
      });
    };

    const onSelectionChange = () => {
      if (composing.current) return;
      sync();
      refreshSlash();
    };

    const onBeforeInput = (event: InputEvent) => {
      setLinkCard(null);
      if (composing.current || event.isComposing || event.inputType === "insertCompositionText") return;
      event.preventDefault();
      if (!sync()) return;
      const data = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
      switch (event.inputType) {
        case "insertText":
        case "insertReplacementText":
        case "insertFromPaste": {
          if (!data) break;
          const before = editor.selection;
          const anchor = caretRect();
          // A pasted mention placeholder has no page to point at, so it's dropped.
          editor.type(data.replace(/\r\n?/g, "\n").replace(/\uFFFC/g, ""));
          if (data === "/" || data === "@") openMenuAt(before.blockId, Math.min(before.anchor, before.focus), anchor);
          break;
        }
        case "insertParagraph":
          editor.enter();
          break;
        case "insertLineBreak":
          editor.lineBreak();
          break;
        case "deleteContentBackward":
        case "deleteByCut":
          editor.deleteBackward();
          break;
        case "deleteWordBackward":
          editor.deleteBackward("word");
          break;
        case "deleteSoftLineBackward":
        case "deleteHardLineBackward":
          editor.setSelection({ ...editor.selection, anchor: 0 });
          editor.deleteBackward();
          break;
        case "deleteContentForward":
          editor.deleteForward();
          break;
        case "deleteWordForward":
          editor.deleteForward("word");
          break;
        case "formatBold":
          editor.toggleMark("bold");
          break;
        case "formatItalic":
          editor.toggleMark("italic");
          break;
        case "formatUnderline":
          editor.toggleMark("underline");
          break;
        case "historyUndo":
          editor.undo();
          break;
        case "historyRedo":
          editor.redo();
          break;
        default:
          return;
      }
      edited();
      refreshSlash();
    };

    const onCompositionStart = () => {
      composing.current = true;
    };

    // While composing, the browser owns the text. At the end, read what changed and apply it as one edit.
    const onCompositionEnd = (event: CompositionEvent) => {
      composing.current = false;
      const element = (event.target as HTMLElement).closest<HTMLElement>("[data-block-id]");
      if (!element) return;
      const id = element.dataset.blockId!;
      const before = plain(getBlock(editor.state, id).content);
      const after = textOf(element).replace(/\n$/, before.endsWith("\n") ? "\n" : "");
      let start = 0;
      while (start < before.length && start < after.length && before[start] === after[start]) start++;
      let end = 0;
      while (end < before.length - start && end < after.length - start && before.at(-1 - end) === after.at(-1 - end)) end++;
      editor.setSelection({ blockId: id, anchor: start, focus: before.length - end });
      const inserted = after.slice(start, after.length - end);
      if (inserted) editor.type(inserted);
      else if (start !== before.length - end) editor.deleteBackward();
      renderRichText(element, getBlock(editor.state, id).content);
      edited();
      // Some keyboards (iPadOS with layered or dead keys) deliver `/` and `@` as composed text.
      if (inserted.endsWith("/") || inserted.endsWith("@")) openMenuAt(id, start + inserted.length - 1, null);
    };

    /** Moves the caret to another block without editing. */
    const moveTo = (selection: Selection) => {
      editor.setSelection(selection);
      writeSelection(root, selection);
    };

    const neighbour = (id: string, step: -1 | 1) => {
      const order = caretOrder(editor.state, editor.closed).filter((blockId) => editableOf(root, blockId));
      return order[order.indexOf(id) + step];
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (composing.current || event.isComposing) return;
      // Only keys typed into the text: buttons placed inside the editor (a task's actions) keep their own keys.
      if (!(event.target instanceof HTMLElement) || !event.target.closest(".editable")) return;
      const selection = sync();
      if (!selection) return;
      const element = editableOf(root, selection.blockId)!;
      const length = plain(getBlock(editor.state, selection.blockId).content).length;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      // While the slash menu is open, it gets the navigation keys.
      const menu = slashRef.current;
      const matches = menu && slashMatches(editor, menu, foundRef.current);
      if (menu && matches && !mod) {
        const index = matches.commands.findIndex((c) => c.value === menu.active);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const count = matches.commands.length;
          if (count > 0) {
            const next = (index + (event.key === "ArrowDown" ? 1 : -1) + count) % count;
            setSlash({ ...menu, active: matches.commands[next]!.value });
          }
          return;
        }
        // Tab and Page Down turn to the next page, Shift+Tab and Page Up back. Tab never nests the block while the menu is open.
        if (event.key === "Tab" || event.key === "PageDown" || event.key === "PageUp") {
          event.preventDefault();
          setSlash(
            turnPage(editor, menu, event.key === "PageUp" || (event.key === "Tab" && event.shiftKey) ? -1 : 1, foundRef.current),
          );
          return;
        }
        if (event.key === "Enter" && index >= 0) {
          event.preventDefault();
          applySlash(matches.commands[index]!);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setSlash(null);
          return;
        }
      }
      let handled = true;

      if (event.key === "Enter" && mod && draftRef.current) {
        event.preventDefault();
        draftRef.current.onSubmit();
        return;
      }
      if (event.key === "Enter" && mod && getBlock(editor.state, selection.blockId).type === "code") {
        editor.exitBlock();
      } else if (event.key === "Enter" && !mod) {
        if (event.shiftKey) editor.lineBreak();
        else editor.enter();
      } else if (event.key === "Backspace" && isCollapsed(selection) && selection.focus === 0 && !mod && !event.altKey) {
        editor.deleteBackward();
      } else if (event.key === "Delete" && isCollapsed(selection) && selection.focus === length && !mod && !event.altKey) {
        editor.deleteForward();
      } else if (event.key === "Tab") {
        editor.tab(event.shiftKey);
      } else if (mod && key === "z") {
        if (event.shiftKey) editor.redo();
        else editor.undo();
      } else if (mod && key === "y") {
        editor.redo();
      } else if (mod && key === "b") {
        editor.toggleMark("bold");
      } else if (mod && key === "i") {
        editor.toggleMark("italic");
      } else if (mod && key === "u") {
        editor.toggleMark("underline");
      } else if (mod && event.shiftKey && key === "s") {
        editor.toggleMark("strikethrough");
      } else if (mod && key === "e") {
        editor.toggleMark("code");
      } else if (mod && key === "k" && getBlock(editor.state, selection.blockId).type === "code") {
        // Code holds no links.
      } else if (mod && key === "k") {
        const content = getBlock(editor.state, selection.blockId).content;
        if (!isCollapsed(selection)) {
          const start = Math.min(selection.anchor, selection.focus);
          const end = Math.max(selection.anchor, selection.focus);
          setLinkFor({ selection, href: linkAt(content, start, end) ?? "" });
        } else {
          // With the caret on a link, edit that whole link.
          const link = linkRangeAt(content, selection.focus);
          if (link) {
            const whole = { blockId: selection.blockId, anchor: link.start, focus: link.end };
            editor.setSelection(whole);
            writeSelection(root, whole);
            setLinkFor({ selection: whole, href: link.href });
          }
        }
      } else {
        handled = false;
        // Arrows leave the block only from its edges; inside it the browser moves the caret.
        const plainArrow = !mod && !event.shiftKey && !event.altKey;
        if (plainArrow && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
          const up = event.key === "ArrowUp";
          if (caretOnEdgeLine(element, up ? "first" : "last")) {
            // In a table, ↑ and ↓ keep to the column, leaving the table from its first or last row.
            const inTable = getBlock(editor.state, selection.blockId).type === "table_cell";
            const target = inTable
              ? verticalNeighbour(editor.state, selection.blockId, up, editor.closed)
              : neighbour(selection.blockId, up ? -1 : 1);
            if (target) {
              goalX.current ??= caretRect()?.left ?? element.getBoundingClientRect().left;
              moveTo(caret(target, offsetAtX(editableOf(root, target)!, goalX.current, up ? "last" : "first")));
              event.preventDefault();
            }
          }
          return;
        }
        if (plainArrow && event.key === "ArrowLeft" && isCollapsed(selection) && selection.focus === 0) {
          const target = neighbour(selection.blockId, -1);
          if (target) {
            moveTo(caret(target, plain(getBlock(editor.state, target).content).length));
            event.preventDefault();
          }
        } else if (plainArrow && event.key === "ArrowRight" && isCollapsed(selection) && selection.focus === length) {
          const target = neighbour(selection.blockId, 1);
          if (target) {
            moveTo(caret(target, 0));
            event.preventDefault();
          }
        }
        if (!event.key.startsWith("Arrow")) goalX.current = null;
        return;
      }
      if (handled) {
        event.preventDefault();
        edited();
        refreshSlash();
      }
    };

    applySlashRef.current = applySlash;

    // Browsers don't follow links inside editable text: links to app pages open here, others in a new tab.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(".editable a[href]");
      if (!link || !root.contains(link)) return;
      event.preventDefault();
      if (link.origin === window.location.origin) void navigateRef.current(withoutBase(link.pathname) + link.search + link.hash);
      else window.open(link.href, "_blank", "noopener,noreferrer");
    };

    // Resting on a link shows its card (after a moment); leaving the link starts closing it, unless the pointer reaches the card.
    // Pointer events, not mouse events: they arrive in order with the card's pointerenter, which cancels the close.
    const onPointerOver = (event: PointerEvent) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(".editable a[href]");
      if (!link || !root.contains(link)) return;
      cardTimers.cancelClose();
      if (linkCardRef.current?.element === link) return;
      cardTimers.open(() => showLinkCard(link));
    };
    const onPointerOut = (event: PointerEvent) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(".editable a[href]");
      if (!link || link.contains(event.relatedTarget as Node | null)) return;
      cardTimers.cancelOpen();
      if (linkCardRef.current) cardTimers.close(() => setLinkCard(null));
    };
    const onScroll = () => setLinkCard(null);

    document.addEventListener("selectionchange", onSelectionChange);
    root.addEventListener("click", onClick);
    root.addEventListener("pointerover", onPointerOver);
    root.addEventListener("pointerout", onPointerOut);
    window.addEventListener("scroll", onScroll, true);
    root.addEventListener("beforeinput", onBeforeInput);
    root.addEventListener("keydown", onKeyDown);
    root.addEventListener("compositionstart", onCompositionStart);
    root.addEventListener("compositionend", onCompositionEnd);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      root.removeEventListener("click", onClick);
      root.removeEventListener("pointerover", onPointerOver);
      root.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("scroll", onScroll, true);
      cardTimers.cancelOpen();
      cardTimers.cancelClose();
      root.removeEventListener("beforeinput", onBeforeInput);
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("compositionstart", onCompositionStart);
      root.removeEventListener("compositionend", onCompositionEnd);
    };
  }, [editor, setSlash]);

  // Screen readers follow the highlighted command while focus stays in the block.
  useEffect(() => {
    if (!slash || !rootRef.current) return;
    const element = editableOf(rootRef.current, slash.blockId);
    if (!element) return;
    element.setAttribute("aria-controls", SLASH_MENU_ID);
    if (slash.active)
      element.setAttribute("aria-activedescendant", `${SLASH_MENU_ID}-option-${encodeURIComponent(slash.active)}`);
    return () => {
      element.removeAttribute("aria-controls");
      element.removeAttribute("aria-activedescendant");
    };
  }, [slash]);

  const slashOptions = slash ? (slashMatches(editor, slash, found)?.commands ?? []) : [];

  // ----- Link card actions -----

  const openLink = (card: LinkCard) => {
    setLinkCard(null);
    const link = card.element;
    if (link.origin === window.location.origin) void navigate(withoutBase(link.pathname) + link.search + link.hash);
    else window.open(link.href, "_blank", "noopener,noreferrer");
  };
  const editLink = (card: LinkCard) => {
    setLinkCard(null);
    const whole = { blockId: card.blockId, anchor: card.start, focus: card.end };
    editor.setSelection(whole);
    if (rootRef.current) writeSelection(rootRef.current, whole);
    setLinkFor({ selection: whole, href: card.href });
  };
  const removeLink = (card: LinkCard) => {
    setLinkCard(null);
    editor.setSelection({ blockId: card.blockId, anchor: card.start, focus: card.end });
    editor.setLink(null);
    editor.setSelection(caret(card.blockId, card.end));
    restoreSelection.current = true;
  };

  const actions = useMemo(
    () => ({
      toggleTodo: (id: string) => editor.toggleTodo(id),
      toggleOpen: (id: string) => editor.toggleOpen(id),
      run: (command: (editor: Editor) => unknown) => {
        command(editor);
        restoreSelection.current = true;
      },
    }),
    [editor],
  );

  const { state, closed } = editor;
  const statusText = (
    <span aria-live="polite">
      <Typography variant="caption" color={status === "failed" || status === "retrying" ? "error" : "text.secondary"}>
        {STATUS_TEXT[status]}
      </Typography>
    </span>
  );
  const root = state.blocks[state.rootId]!;

  return (
    <MentionTargetsContext.Provider value={mentionTargets}>
      <SuggestionsContext.Provider value={{ ...suggestions, busy: deciding }}>
        <div className="page-editor" ref={rootRef} style={{ "--editor-link": linkColor } as CSSProperties}>
          {/* A draft has nothing to save, so no saving indicator. */}
          {!draft && (statusSlot ? createPortal(statusText, statusSlot) : <div className="editor-status">{statusText}</div>)}
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}
          {page.title && (
            <Typography variant={titleVariant}>
              <EditableText block={root} placeholder="Untitled" ariaLabel="Title" />
            </Typography>
          )}
          {afterTitle}
          {!hideBody && decided && (
            <Alert
              severity={decided.failed ? "error" : "success"}
              role={decided.failed ? "alert" : "status"}
              onClose={() => setDecided(null)}
              actions={
                decided.undo && (
                  <Button
                    size="small"
                    variant="text"
                    disabled={deciding}
                    onClick={() => void sendDecision({ intent: "reopen", id: decided.undo! })}
                  >
                    Undo
                  </Button>
                )
              }
            >
              {decided.message}
            </Alert>
          )}
          {!hideBody && suggestions.views.length > 0 && (
            <div className="suggestions-bar">
              <Typography variant="body2" color="text.secondary">
                {suggestions.views.length === 1 ? "1 suggestion to review" : `${suggestions.views.length} suggestions to review`}
              </Typography>
              {suggestions.views.length > 1 && (
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="text"
                    disabled={deciding}
                    onClick={() => void sendDecision({ intent: "reject-all", pageId: page.pageId })}
                  >
                    Reject all
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={deciding}
                    onClick={() => void sendDecision({ intent: "approve-all", pageId: page.pageId })}
                  >
                    Approve all
                  </Button>
                </Stack>
              )}
            </div>
          )}
          <div className="editor-body" hidden={hideBody}>
            {root.children.length === 0 ? (
              <button
                type="button"
                className="editor-empty"
                onClick={() => {
                  editor.setSelection(caret(state.rootId, 0));
                  editor.enter();
                  restoreSelection.current = true;
                }}
              >
                <Typography color="text.secondary">{emptyText}</Typography>
              </button>
            ) : (
              <EditorBlocks state={state} ids={root.children} closed={closed} references={page.references} actions={actions} />
            )}
          </div>

          <InlineCommandMenu
            id={SLASH_MENU_ID}
            open={slash !== null}
            anchorRect={slash?.anchor ?? null}
            ariaLabel={slash?.kind === "page" ? "Mention a page" : "Turn into"}
            options={slashOptions.map(({ value, label, description }) => ({
              value,
              label,
              ...(description ? { description } : {}),
            }))}
            activeValue={slash?.active ?? null}
            onActiveValueChange={(value) => slash && setSlash({ ...slash, active: value })}
            onSelect={(value) => {
              const item = slashOptions.find((c) => c.value === value);
              if (item) applySlashRef.current?.(item);
            }}
            onDismiss={() => setSlash(null)}
            emptyText={slash?.kind === "page" ? (found === null ? "Searching…" : "No page matches") : "No matching blocks"}
          />
          <HoverCard
            open={linkCard !== null}
            anchorRect={linkCard?.rect ?? null}
            ariaLabel="Link"
            onPointerEnter={cardTimers.cancelClose}
            onPointerLeave={() => cardTimers.close(() => setLinkCard(null))}
            onDismiss={() => setLinkCard(null)}
          >
            {linkCard && (
              // Pressing a button keeps the caret and selection in the text.
              <div onMouseDown={(event) => event.preventDefault()}>
                <Stack spacing={1}>
                  <Typography variant="body2" noWrap>
                    {linkCard.label}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="text" onClick={() => openLink(linkCard)}>
                      Open
                    </Button>
                    <Button size="small" variant="text" onClick={() => editLink(linkCard)}>
                      Edit
                    </Button>
                    <Button size="small" variant="text" color="error" onClick={() => removeLink(linkCard)}>
                      Remove
                    </Button>
                  </Stack>
                </Stack>
              </div>
            )}
          </HoverCard>
          {linkFor && (
            <LinkDialog
              initial={linkFor.href}
              onDone={(href) => {
                setLinkFor(null);
                if (href === undefined) return;
                editor.setSelection(linkFor.selection);
                editor.setLink(href);
                restoreSelection.current = true;
              }}
            />
          )}
          {blocker.state === "blocked" && (
            <Dialog
              open
              title="Leave without saving?"
              onClose={() => blocker.reset()}
              cancelAction={{ label: "Stay", onClick: () => blocker.reset() }}
              confirmAction={{ label: "Leave", onClick: () => blocker.proceed() }}
            >
              <Stack spacing={1}>
                <Typography>Some edits haven't been saved yet. If you leave now they'll be lost.</Typography>
              </Stack>
            </Dialog>
          )}
        </div>
      </SuggestionsContext.Provider>
    </MentionTargetsContext.Provider>
  );
}
