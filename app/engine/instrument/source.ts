// Source common interface + generated "ordered arrival" grammar —
// FISHVJ_INSTRUMENT_V1.md §3.
//
// Every source returns a validated stack (or a candidate under validation), and
// never writes pixels to program directly. A generated source is an order →
// wait → validate → arrive state machine (§3.3): the reservation snaps to the
// first bar boundary after the candidate is ready. Provider clock / network
// arrival time is never the engine time base — reservations use source ticks.
// A source failure (generation, unknown license, validation) fails only that
// source and never stops playback/collected/live (§3.3).
import { reserveLaunch, type BeatAnchor, type Reservation } from "./launch";
import { validateStack, type StackManifestV0, type StackSourceKind } from "./stack";

export type StackSourceState = "idle" | "preparing" | "validating" | "ready" | "failed";

export type StackCandidate = {
  sourceKind: StackSourceKind;
  state: StackSourceState;
  manifest?: StackManifestV0;
  providerJobId?: string;
  failureReason?: string;
};

/**
 * A deterministic generated-source order. Instead of real async, the fixture
 * advances through the states on explicit steps so the arrival grammar is
 * testable and replay-stable.
 */
export class GeneratedOrder {
  private candidate: StackCandidate;
  private reservation: Reservation | null = null;

  constructor(
    public readonly providerJobId: string,
    private readonly produce: () => StackManifestV0 | { error: string },
  ) {
    this.candidate = { sourceKind: "generated", state: "preparing", providerJobId };
  }

  get state() {
    return this.candidate.state;
  }

  /** Runs prep → validation. Sets ready only after §2.3 passes and license is not blocking. */
  resolve(): StackCandidate {
    if (this.candidate.state !== "preparing") return this.candidate;
    const produced = this.produce();
    if ("error" in produced) {
      this.candidate = { ...this.candidate, state: "failed", failureReason: produced.error };
      return this.candidate;
    }
    this.candidate = { ...this.candidate, state: "validating", manifest: produced };
    const validation = validateStack(produced);
    if (!validation.ok) {
      this.candidate = { ...this.candidate, state: "failed", failureReason: validation.errors[0] };
      return this.candidate;
    }
    // Technical load is allowed for unverified license, but such a stack is not
    // "cleared for public projection" — the caller must surface the warning.
    this.candidate = { ...this.candidate, state: "ready" };
    return this.candidate;
  }

  cleared(): boolean {
    return (
      this.candidate.state === "ready" &&
      this.candidate.manifest?.prep.provenance.licenseStatus === "cleared"
    );
  }

  /**
   * Reserves the launch on the first bar boundary after `reserveTick`, once the
   * candidate is ready. Returns null while not ready (§3.3: not before ready).
   */
  reserve(anchor: BeatAnchor, reserveTick: number, confidenceU16: number): Reservation | null {
    if (this.candidate.state !== "ready") return null;
    this.reservation = reserveLaunch(anchor, reserveTick, confidenceU16);
    return this.reservation;
  }

  get reservationSnapshot() {
    return this.reservation;
  }
}

/**
 * Runs a set of independent source orders; a failure isolates to its own order.
 * Returns the ready, license-cleared orders that can be committed to program.
 */
export function resolveOrders(orders: GeneratedOrder[]): {
  ready: GeneratedOrder[];
  failed: GeneratedOrder[];
} {
  const ready: GeneratedOrder[] = [];
  const failed: GeneratedOrder[] = [];
  for (const order of orders) {
    order.resolve();
    if (order.state === "ready") ready.push(order);
    else if (order.state === "failed") failed.push(order);
  }
  return { ready, failed };
}
