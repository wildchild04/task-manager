import { afterEach, describe, expect, it, vi } from "vitest";

import { changeStream } from "../../app/lib/changes.server";
import { createInMemoryServices } from "~/composition";

const services = vi.hoisted(() => ({ current: undefined as ReturnType<typeof createInMemoryServices> | undefined }));
vi.mock("../../app/lib/services.server", async () => {
  const { createInMemoryServices } = await import("~/composition");
  services.current = createInMemoryServices();
  return { services: services.current };
});

/** Reads the stream's text as it arrives. */
function reader(response: Response) {
  const stream = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  return {
    /** Reads until the text so far contains `expected`, and returns it. */
    async until(expected: string): Promise<string> {
      while (!text.includes(expected)) {
        const { value, done } = await stream.read();
        if (done) throw new Error(`Stream ended before ${JSON.stringify(expected)}; got ${JSON.stringify(text)}`);
        text += decoder.decode(value, { stream: true });
      }
      return text;
    },
    async ended(): Promise<boolean> {
      return (await stream.read()).done;
    },
  };
}

const page = (id: string) => ({ op: "insert" as const, block: { id, type: "page" as const }, parentId: null });

describe("the change stream", () => {
  afterEach(() => vi.useRealTimers());

  it("answers an uncached event stream that starts with hello and the current number", async () => {
    const { loader } = await import("../../app/routes/api.changes");
    const live = services.current!;
    live.blocks.apply([page("before")]);
    const abort = new AbortController();
    const response = loader({ request: new Request("http://app/api/changes", { signal: abort.signal }) } as never);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(response.headers.get("x-accel-buffering")).toBe("no");

    const events = reader(response);
    const current = live.changes.current;
    expect(await events.until("event: hello")).toBe(`retry: 3000\n\nevent: hello\ndata: {"seq":${current}}\n\n`);

    live.blocks.apply([page("after")]);
    expect(await events.until("event: change")).toContain(`event: change\ndata: {"seq":${current + 1}}\n\n`);
    abort.abort();
    expect(await events.ended()).toBe(true);
  });

  it("pings while nothing changes", async () => {
    vi.useFakeTimers();
    const live = createInMemoryServices();
    const abort = new AbortController();
    const events = reader(changeStream(live.changes, abort.signal));
    await events.until("event: hello");
    vi.advanceTimersByTime(25_000);
    expect(await events.until(": ping")).toMatch(/\n\n: ping\n\n$/);
    abort.abort();
  });

  it("stops listening once the client goes away", async () => {
    const live = createInMemoryServices();
    const subscribe = vi.spyOn(live.changes, "subscribe");
    const abort = new AbortController();
    const events = reader(changeStream(live.changes, abort.signal));
    await events.until("event: hello");
    const unsubscribe = subscribe.mock.results[0]!.value as () => boolean;
    abort.abort();
    expect(await events.ended()).toBe(true);
    // Already unsubscribed: removing it again finds nothing.
    expect(unsubscribe()).toBe(false);
    live.blocks.apply([page("later")]);
  });
});
