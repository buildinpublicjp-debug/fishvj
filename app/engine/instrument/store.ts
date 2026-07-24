// Instrument store — the performance-surface counterpart of the fish engine
// store. Wraps the pure InstrumentState reducer/tick, the clock anchor, and the
// VJ quantized-launch reservation into a subscribable store, and derives the
// composite params that both the program and preview outputs read from one tick
// (FISHVJ_INSTRUMENT_V1.md §6.1, §6.3, §7.4).
import {
  adoptAnchor,
  canonicalizeClock,
  firstAnchor,
  reserveLaunch,
  type BeatAnchor,
  type Reservation,
} from "./launch";
import { Q16_ONE } from "./fixed";
import {
  advanceInstrumentTick,
  createInstrumentState,
  reduceInstrument,
  type ControlGrammar,
  type DeckId,
  type InstrumentEvent,
  type InstrumentState,
} from "./transport";

export type PendingLaunch = { deck: DeckId; reservation: Reservation };

export type DeckSnapshot = {
  stackHash: string | null;
  playing: boolean;
  framePosition: number; // Q16 frame from playheadQ17/2, decoded to a float frame
  rate: number;
  direction: "forward" | "reverse";
  opacity: number;
  eq: { LOW: number; MID: number; HI: number };
  // Ramp targets. UI sliders bind to these (they follow the finger instantly);
  // the ramped values above are what the renderer applies. Binding sliders to
  // the ramped value makes React fight the drag with ~130ms of rubber-banding.
  rateTarget: number;
  opacityTarget: number;
  eqTarget: { LOW: number; MID: number; HI: number };
};

export type InstrumentSnapshot = {
  tick: number;
  controlGrammar: ControlGrammar;
  previewDeck: DeckId;
  crossfader: number;
  crossfaderTarget: number;
  A: DeckSnapshot;
  B: DeckSnapshot;
  pendingLaunch: { deck: DeckId; targetTick: number; ticksRemaining: number } | null;
  bpm: number;
};

const deckSnapshot = (deck: InstrumentState["A"]): DeckSnapshot => ({
  stackHash: deck.stackHash,
  playing: deck.playing,
  framePosition: Number(deck.playheadQ17 / BigInt(2)) / Q16_ONE,
  rate: deck.rate.valueQ16 / Q16_ONE,
  direction: deck.direction,
  opacity: deck.opacity.valueQ16 / Q16_ONE,
  eq: {
    LOW: deck.eqLow.valueQ16 / Q16_ONE,
    MID: deck.eqMid.valueQ16 / Q16_ONE,
    HI: deck.eqHi.valueQ16 / Q16_ONE,
  },
  rateTarget: deck.rate.targetQ16 / Q16_ONE,
  opacityTarget: deck.opacity.targetQ16 / Q16_ONE,
  eqTarget: {
    LOW: deck.eqLow.targetQ16 / Q16_ONE,
    MID: deck.eqMid.targetQ16 / Q16_ONE,
    HI: deck.eqHi.targetQ16 / Q16_ONE,
  },
});

export type InstrumentStore = {
  dispatch(event: InstrumentEvent): void;
  /** VJ launch: reserve the preview deck to the next bar; returns the target tick. */
  reservePreviewLaunch(): number | null;
  advanceTick(): InstrumentSnapshot;
  getState(): Readonly<InstrumentState>;
  getSnapshot(): InstrumentSnapshot;
  subscribe(listener: () => void): () => void;
};

export function createInstrumentStore(bpm = 138): InstrumentStore {
  let state = createInstrumentState();
  // v0 uses a fixed BPM anchor; a live clock would re-adopt it via adoptAnchor.
  const anchor: BeatAnchor = firstAnchor(0, canonicalizeClock(bpm, 0, 1));
  let pending: PendingLaunch | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const compute = (): InstrumentSnapshot => ({
    tick: state.tick,
    controlGrammar: state.controlGrammar,
    previewDeck: state.previewDeck,
    crossfader: state.crossfader.valueQ16 / Q16_ONE,
    crossfaderTarget: state.crossfader.targetQ16 / Q16_ONE,
    A: deckSnapshot(state.A),
    B: deckSnapshot(state.B),
    pendingLaunch: pending
      ? {
          deck: pending.deck,
          targetTick: pending.reservation.targetTick,
          ticksRemaining: Math.max(0, pending.reservation.targetTick - state.tick),
        }
      : null,
    bpm: anchor.bpmQ16 / Q16_ONE,
  });

  // Cache the snapshot so getSnapshot returns a stable reference between
  // mutations (useSyncExternalStore requires this — a fresh object every call
  // is an infinite render loop). React is notified at ~20Hz; the RAF loop reads
  // getSnapshot directly at 60Hz for the canvases.
  let cached = compute();
  const recache = () => {
    cached = compute();
  };

  return {
    dispatch(event) {
      state = reduceInstrument(state, event);
      recache();
      notify();
    },
    reservePreviewLaunch() {
      const reservation = reserveLaunch(anchor, state.tick, CANONICAL_CONFIDENT);
      pending = { deck: state.previewDeck, reservation };
      recache();
      notify();
      return reservation.targetTick;
    },
    advanceTick() {
      // §6.1 order: launch commit, then transport advance.
      if (pending && state.tick + 1 >= pending.reservation.targetTick) {
        state = reduceInstrument(
          { ...state, tick: state.tick },
          { type: "transport", action: "playing", deck: pending.deck, value: true },
        );
        pending = null;
      }
      state = advanceInstrumentTick(state);
      recache();
      if (state.tick % 2 === 0) notify(); // ~30Hz to React (canvases read at 60Hz)
      return cached;
    },
    getState: () => state,
    getSnapshot: () => cached,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const CANONICAL_CONFIDENT = 65535;

// Re-export the anchor adopt for callers wiring a live clock.
export { adoptAnchor };
