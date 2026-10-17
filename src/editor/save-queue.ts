import type { Operation } from "~/domain/blocks/types";

/** How sending a batch went: saved, a network failure (retry), or rejected by the server (don't retry). */
export type SendResult = { ok: true } | { ok: false; retry: true } | { ok: false; retry: false; message: string };

export type SaveStatus = "saved" | "pending" | "saving" | "retrying" | "failed";

export type SaveQueueOptions = {
  send: (batch: Operation[]) => Promise<SendResult>;
  /** Called when the server rejects a batch: everything queued is dropped and the page should reload. */
  onRejected?: (message: string) => void;
  onStatus?: (status: SaveStatus) => void;
  /** How long typing waits before saving. */
  delayMs?: number;
  /** Retry delays after network failures; the last one repeats. */
  retryMs?: readonly number[];
};

/** An update that only changes a block's text; consecutive ones for the same block collapse into the last. */
const isContentUpdate = (op: Operation): op is Extract<Operation, { op: "update" }> =>
  op.op === "update" && op.type === undefined && op.props === undefined && op.content !== undefined;

/**
 * Saves edit batches in order, one request at a time. Typing is saved after
 * a short pause; anything structural is saved at once. A network failure
 * keeps the batch and retries; a rejection drops the queue.
 */
export class SaveQueue {
  private pending: Operation[] = [];
  private inFlight: Operation[] | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private failures = 0;
  private current: SaveStatus = "saved";
  private readonly delayMs: number;
  private readonly retryMs: readonly number[];

  constructor(private readonly options: SaveQueueOptions) {
    this.delayMs = options.delayMs ?? 600;
    this.retryMs = options.retryMs ?? [1000, 2000, 5000, 10000];
  }

  get status(): SaveStatus {
    return this.current;
  }

  /** Whether some edit isn't saved yet. */
  get dirty(): boolean {
    return this.pending.length > 0 || this.inFlight !== null;
  }

  private setStatus(status: SaveStatus) {
    if (status === this.current) return;
    this.current = status;
    this.options.onStatus?.(status);
  }

  enqueue(ops: readonly Operation[]): void {
    for (const op of ops) {
      const last = this.pending.at(-1);
      if (last && isContentUpdate(op) && isContentUpdate(last) && last.id === op.id) this.pending[this.pending.length - 1] = op;
      else this.pending.push(op);
    }
    // While a request is out or a retry is waiting, new edits join the queue and go with the next send.
    if (this.inFlight || this.current === "retrying") return;
    this.setStatus("pending");
    if (ops.every(isContentUpdate)) this.schedule(this.delayMs);
    else this.flush();
  }

  private schedule(ms: number) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), ms);
  }

  /** Sends everything queued now (also used before leaving the page). */
  flush(): void {
    clearTimeout(this.timer);
    if (this.inFlight || this.pending.length === 0) return;
    const batch = this.pending;
    this.pending = [];
    this.inFlight = batch;
    this.setStatus(this.failures > 0 ? "retrying" : "saving");
    void this.options.send(batch).then(
      (result) => this.settle(batch, result),
      () => this.settle(batch, { ok: false, retry: true }),
    );
  }

  private settle(batch: Operation[], result: SendResult) {
    this.inFlight = null;
    if (result.ok) {
      this.failures = 0;
      if (this.pending.length > 0) this.flush();
      else this.setStatus("saved");
      return;
    }
    if (result.retry) {
      // Keep the order: the failed batch goes back in front of anything queued since.
      this.pending = [...batch, ...this.pending];
      this.failures += 1;
      this.setStatus("retrying");
      this.schedule(this.retryMs[Math.min(this.failures - 1, this.retryMs.length - 1)]!);
      return;
    }
    this.pending = [];
    this.failures = 0;
    this.setStatus("failed");
    this.options.onRejected?.(result.message);
  }

  /** Stops timers (when the editor unmounts). */
  dispose(): void {
    clearTimeout(this.timer);
  }
}
