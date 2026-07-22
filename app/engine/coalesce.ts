import type { ParamPayload } from "./types";

type PendingParam = {
  payload: ParamPayload;
  sourceT: number;
};

type TimerHandle = ReturnType<typeof setTimeout>;

/** Canonicalizes continuous UI input before it reaches the event bus. */
export class ParamEventCoalescer {
  private readonly intervalMs: number;
  private readonly emit: (payload: ParamPayload, sourceT: number) => void;
  private readonly now: () => number;
  private pending: PendingParam | null = null;
  private timer: TimerHandle | null = null;
  private lastEmitT = Number.NEGATIVE_INFINITY;

  constructor(
    emit: (payload: ParamPayload, sourceT: number) => void,
    options: { hz?: number; now?: () => number } = {},
  ) {
    const hz = options.hz ?? 8;
    if (!Number.isFinite(hz) || hz <= 0) throw new RangeError("coalesce Hz must be positive");
    this.intervalMs = 1000 / hz;
    this.emit = emit;
    this.now = options.now ?? (() => performance.now());
  }

  push(payload: ParamPayload, sourceT = this.now()) {
    this.pending = { payload, sourceT };
    const delay = this.intervalMs - (this.now() - this.lastEmitT);
    if (delay <= 0 && this.timer === null) {
      this.flush();
      return;
    }
    if (this.timer === null) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.flush();
      }, Math.max(0, delay));
    }
  }

  dispose() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }

  private flush() {
    if (!this.pending) return;
    const pending = this.pending;
    this.pending = null;
    this.lastEmitT = this.now();
    this.emit(pending.payload, pending.sourceT);
  }
}
