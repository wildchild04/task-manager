import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isVimStored, setVimStored, useVimSetting, VIM_STORAGE_KEY } from "../../app/vim-setting";

/** A browser `window` with a local storage that can be made to throw. */
function stubWindow({ broken = false } = {}) {
  const items = new Map<string, string>();
  const fail = () => {
    throw new DOMException("blocked", "SecurityError");
  };
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => (broken ? fail() : (items.get(key) ?? null)),
      setItem: (key: string, value: string) => (broken ? fail() : items.set(key, value)),
      removeItem: (key: string) => (broken ? fail() : items.delete(key)),
    },
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
  });
  return items;
}

describe("the Vim mode setting", () => {
  beforeEach(() => setVimStored(false));
  afterEach(() => vi.unstubAllGlobals());

  it("is off until turned on, and stored as on", () => {
    const items = stubWindow();
    expect(isVimStored()).toBe(false);
    setVimStored(true);
    expect(items.get(VIM_STORAGE_KEY)).toBe("on");
    expect(isVimStored()).toBe(true);
    setVimStored(false);
    expect(items.has(VIM_STORAGE_KEY)).toBe(false);
    expect(isVimStored()).toBe(false);
  });

  it("treats anything but \"on\" as off", () => {
    const items = stubWindow();
    items.set(VIM_STORAGE_KEY, "true");
    expect(isVimStored()).toBe(false);
  });

  it("lasts for the open page where storage can't be used", () => {
    stubWindow({ broken: true });
    expect(isVimStored()).toBe(false);
    setVimStored(true);
    expect(isVimStored()).toBe(true);
  });

  it("renders without Vim mode on the server", () => {
    stubWindow().set(VIM_STORAGE_KEY, "on");
    let seen: ReturnType<typeof useVimSetting> | undefined;
    function Probe() {
      seen = useVimSetting();
      return null;
    }
    renderToString(<Probe />);
    expect(seen).toMatchObject({ offered: false, enabled: false });
  });
});
