import type { ChangeFeed } from "~/domain/changes";

/** A comment line this often keeps idle connections open through proxies. */
const PING_MS = 25_000;
/** How long the browser waits before reconnecting after a network error. */
const RETRY_MS = 3000;

/**
 * A Server-Sent Events stream of the change feed: `hello` with the current
 * number, then a `change` event (`{ seq }`) after each committed write. Change
 * numbers only, never content. It stops listening once `signal` aborts (the
 * tab closed, or the proxy dropped the connection).
 */
export function changeStream(feed: ChangeFeed, signal: AbortSignal, pingMs = PING_MS): Response {
  const encoder = new TextEncoder();
  let stop = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      const event = (name: string, seq: number) => send(`event: ${name}\ndata: ${JSON.stringify({ seq })}\n\n`);

      send(`retry: ${RETRY_MS}\n\n`);
      event("hello", feed.current);
      const unsubscribe = feed.subscribe((seq) => event("change", seq));
      const ping = setInterval(() => send(": ping\n\n"), pingMs);
      stop = () => {
        stop = () => {};
        unsubscribe();
        clearInterval(ping);
        try {
          controller.close();
        } catch {
          // Already closed by the reader going away.
        }
      };
      if (signal.aborted) stop();
      else signal.addEventListener("abort", () => stop(), { once: true });
    },
    cancel() {
      stop();
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
