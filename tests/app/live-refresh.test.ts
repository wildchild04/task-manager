import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type ChangeSource, followChanges, recordOwnChange } from "../../app/lib/live-refresh";

/** A stand-in for `EventSource` that the test drives. */
class FakeSource implements ChangeSource {
  readyState = 1;
  closed = false;
  private listeners = new Map<string, ((event: Event) => void)[]>();
  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  emit(type: "hello" | "change", seq: number) {
    for (const listener of this.listeners.get(type) ?? []) listener(new MessageEvent(type, { data: JSON.stringify({ seq }) }));
  }
  fail(readyState: number) {
    this.readyState = readyState;
    for (const listener of this.listeners.get("error") ?? []) listener(new Event("error"));
  }
}

describe("following changes", () => {
  let sources: FakeSource[];
  let hidden: boolean;
  let refresh: ReturnType<typeof vi.fn<() => Promise<void>>>;
  let stop: () => void;
  let visible: () => void;
  const source = () => sources.at(-1)!;

  beforeEach(() => {
    vi.useFakeTimers();
    sources = [];
    hidden = false;
    refresh = vi.fn(() => Promise.resolve());
    ({ stop, visible } = followChanges({
      open: () => {
        sources.push(new FakeSource());
        return source();
      },
      refresh,
      hidden: () => hidden,
    }));
    source().emit("hello", 10);
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it("refreshes once for changes arriving close together", async () => {
    source().emit("change", 11);
    source().emit("change", 12);
    source().emit("change", 13);
    await vi.advanceTimersByTimeAsync(150);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("doesn't refresh for its own saves, even when the answer comes after the event", async () => {
    source().emit("change", 11);
    recordOwnChange(11);
    await vi.advanceTimersByTimeAsync(150);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes once more after a refresh that a change arrived during", async () => {
    let finish!: () => void;
    refresh.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
    source().emit("change", 11);
    await vi.advanceTimersByTimeAsync(150);
    source().emit("change", 12);
    source().emit("change", 13);
    await vi.advanceTimersByTimeAsync(150);
    expect(refresh).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("waits until the tab is visible", async () => {
    hidden = true;
    source().emit("change", 11);
    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).not.toHaveBeenCalled();
    hidden = false;
    visible();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("reconnects with a growing delay after an error answer, and catches up", async () => {
    source().fail(0); // A network error: EventSource retries by itself.
    expect(sources).toHaveLength(1);
    source().fail(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sources).toHaveLength(2);
    source().fail(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(sources).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(sources).toHaveLength(3);
    // Only its own save happened meanwhile: nothing to catch up on.
    recordOwnChange(11);
    source().emit("hello", 11);
    expect(refresh).not.toHaveBeenCalled();
    source().emit("hello", 12);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes when the server restarted", () => {
    source().emit("hello", 2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("caps the reconnect delay at 30 seconds", async () => {
    for (let i = 0; i < 8; i++) {
      source().fail(2);
      await vi.advanceTimersByTimeAsync(30_000);
    }
    const count = sources.length;
    source().fail(2);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(sources).toHaveLength(count);
    await vi.advanceTimersByTimeAsync(1);
    expect(sources).toHaveLength(count + 1);
  });
});
