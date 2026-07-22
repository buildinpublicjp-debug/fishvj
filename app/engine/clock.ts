import { TICK_MS } from "./types";

export class FixedStepClock {
  private accumulatorMs = 0;
  private lastNow: number | null = null;

  accumulate(now: number) {
    if (!Number.isFinite(now)) throw new RangeError("clock time must be finite");
    if (this.lastNow === null) {
      this.lastNow = now;
      return;
    }
    this.accumulatorMs += Math.max(0, now - this.lastNow);
    this.lastNow = now;
  }

  takeTicks(maxTicks = 5) {
    const available = Math.floor((this.accumulatorMs + Number.EPSILON * 1e6) / TICK_MS);
    const count = Math.min(maxTicks, available);
    this.accumulatorMs -= count * TICK_MS;
    return count;
  }

  get pendingTicks() {
    return Math.floor((this.accumulatorMs + Number.EPSILON * 1e6) / TICK_MS);
  }

  reset() {
    this.accumulatorMs = 0;
    this.lastNow = null;
  }
}

export class DeterministicClock {
  private queuedTicks = 0;

  queue(ticks: number) {
    if (!Number.isInteger(ticks) || ticks < 0) {
      throw new RangeError("deterministic ticks must be a non-negative integer");
    }
    this.queuedTicks += ticks;
  }

  takeTicks(maxTicks = Number.MAX_SAFE_INTEGER) {
    const count = Math.min(maxTicks, this.queuedTicks);
    this.queuedTicks -= count;
    return count;
  }
}
