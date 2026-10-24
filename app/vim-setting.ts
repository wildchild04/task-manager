import { useCallback, useSyncExternalStore } from "react";

/** The local storage key; `"on"` turns Vim mode on, anything else (or nothing) leaves it off. */
export const VIM_STORAGE_KEY = "vim-mode";

/** Where Vim mode is offered: browsers with a mouse or trackpad, where a hardware keyboard is likely. */
export const VIM_MEDIA_QUERY = "(hover: hover) and (pointer: fine)";

/** The setting, for when local storage can't be used (private windows, blocked site data): it lasts for the open page. */
let fallback = false;
const listeners = new Set<() => void>();

/** Whether Vim mode is stored as on in this browser. */
export function isVimStored(): boolean {
  try {
    return window.localStorage.getItem(VIM_STORAGE_KEY) === "on";
  } catch {
    return fallback;
  }
}

/** Turns Vim mode on or off in this browser. */
export function setVimStored(on: boolean): void {
  fallback = on;
  try {
    if (on) window.localStorage.setItem(VIM_STORAGE_KEY, "on");
    else window.localStorage.removeItem(VIM_STORAGE_KEY);
  } catch {
    // Kept in `fallback` for this page.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changed the setting.
  const onStorage = (event: StorageEvent) => {
    if (event.key === VIM_STORAGE_KEY || event.key === null) listener();
  };
  const media = window.matchMedia(VIM_MEDIA_QUERY);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", listener);
  };
}

const offered = () => window.matchMedia(VIM_MEDIA_QUERY).matches;

export type VimSetting = {
  /** Whether this browser offers Vim mode at all (desktop browsers); false on the server and before hydration. */
  offered: boolean;
  /** Whether Vim mode is on: stored as on, and offered. */
  enabled: boolean;
  setEnabled: (on: boolean) => void;
};

/**
 * The Vim mode setting, kept in local storage and off by default. Both parts
 * are read in the browser only, so the server and the first render are
 * without Vim mode.
 */
export function useVimSetting(): VimSetting {
  const isOffered = useSyncExternalStore(subscribe, offered, () => false);
  const stored = useSyncExternalStore(subscribe, isVimStored, () => false);
  const setEnabled = useCallback((on: boolean) => setVimStored(on), []);
  return { offered: isOffered, enabled: isOffered && stored, setEnabled };
}
