import { describe, expect, it, vi } from "vitest";

import { createChangeFeed } from "~/domain/changes";

describe("change feed", () => {
  it("numbers committed writes from 1 and tells listeners", () => {
    const { feed, committed } = createChangeFeed();
    const seen: number[] = [];
    feed.subscribe((seq) => seen.push(seq));
    expect(feed.current).toBe(0);
    expect(committed()).toBe(1);
    committed();
    expect(feed.current).toBe(2);
    expect(seen).toEqual([1, 2]);
  });

  it("stops telling a listener once unsubscribed", () => {
    const { feed, committed } = createChangeFeed();
    const listener = vi.fn();
    const unsubscribe = feed.subscribe(listener);
    committed();
    unsubscribe();
    committed();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps telling the others when a listener throws", () => {
    const { feed, committed } = createChangeFeed();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const other = vi.fn();
    feed.subscribe(() => {
      throw new Error("gone");
    });
    feed.subscribe(other);
    expect(committed()).toBe(1);
    expect(other).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
