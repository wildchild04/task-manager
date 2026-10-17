import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Operation } from "~/domain/blocks/types";
import { type SaveStatus, SaveQueue, type SendResult } from "~/editor/save-queue";

const typed = (id: string, value: string): Operation => ({ op: "update", id, content: [{ text: value }] });
const inserted = (id: string): Operation => ({ op: "insert", block: { id, type: "paragraph" }, parentId: "page", afterId: null });

describe("save queue", () => {
  let sent: Operation[][];
  let replies: Array<(result: SendResult) => void>;
  let statuses: SaveStatus[];
  let rejected: string[];
  let queue: SaveQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    replies = [];
    statuses = [];
    rejected = [];
    queue = new SaveQueue({
      send: (batch) => {
        sent.push(batch);
        return new Promise((resolve) => replies.push(resolve));
      },
      onStatus: (status) => statuses.push(status),
      onRejected: (message) => rejected.push(message),
      delayMs: 600,
      retryMs: [1000, 3000],
    });
  });

  afterEach(() => vi.useRealTimers());

  const reply = async (result: SendResult) => {
    replies.shift()!(result);
    await vi.advanceTimersByTimeAsync(0);
  };

  it("waits for a pause in typing and sends the last text of each block once", async () => {
    queue.enqueue([typed("a", "H")]);
    queue.enqueue([typed("a", "He")]);
    await vi.advanceTimersByTimeAsync(500);
    queue.enqueue([typed("a", "Hey")]);
    await vi.advanceTimersByTimeAsync(500);
    expect(sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(100);
    expect(sent).toEqual([[typed("a", "Hey")]]);
    expect(queue.dirty).toBe(true);
    await reply({ ok: true });
    expect(queue.dirty).toBe(false);
    expect(statuses).toEqual(["pending", "saving", "saved"]);
  });

  it("sends structural edits at once, with the typing before them, in order", () => {
    queue.enqueue([typed("a", "Hello")]);
    queue.enqueue([inserted("b")]);
    expect(sent).toEqual([[typed("a", "Hello"), inserted("b")]]);
  });

  it("keeps one request in flight and sends what queued meanwhile next", async () => {
    queue.enqueue([inserted("b")]);
    queue.enqueue([inserted("c")]);
    expect(sent).toHaveLength(1);
    await reply({ ok: true });
    expect(sent).toEqual([[inserted("b")], [inserted("c")]]);
  });

  it("retries a failed batch before anything newer, with backoff", async () => {
    queue.enqueue([inserted("b")]);
    await reply({ ok: false, retry: true });
    queue.enqueue([inserted("c")]);
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent[1]).toEqual([inserted("b"), inserted("c")]);
    await reply({ ok: false, retry: true });
    await vi.advanceTimersByTimeAsync(2999);
    expect(sent).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toHaveLength(3);
    await reply({ ok: true });
    expect(queue.status).toBe("saved");
    expect(statuses).toContain("retrying");
  });

  it("drops everything on a rejection and reports it", async () => {
    queue.enqueue([inserted("b")]);
    queue.enqueue([typed("b", "x")]);
    await reply({ ok: false, retry: false, message: "Block b already exists" });
    expect(rejected).toEqual(["Block b already exists"]);
    expect(queue.dirty).toBe(false);
    expect(queue.status).toBe("failed");
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent).toHaveLength(1);
  });

  it("flushes on demand", () => {
    queue.enqueue([typed("a", "x")]);
    queue.flush();
    expect(sent).toEqual([[typed("a", "x")]]);
  });
});
