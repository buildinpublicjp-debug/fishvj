// Instrument transport, mixer and program composite — FISHVJ_INSTRUMENT_V1.md
// §6 (transport) and §7 (2 modes / mixer / preview-program).
//
// Deterministic software core: deck A/B state, Q17 playhead with loop
// wrap/pingpong/hold, cue / hot cue / jog seek, ramped rate / opacity /
// crossfader (§6.1 8-tick ramp), DJ/VJ grammar (input-only switch, §7.1), and
// the linear-RGB premultiplied cross-dissolve composite (§7.4). The quantized
// bar launch (§6.3) integrates with BeatState in S6; the WebCodecs access bench
// (§6.4) and dual-output rendering (§7.4, multi-display "unverified") are
// hardware/integration-gated.
import {
  assertInt64,
  assertRange,
  CROSSFADER_MAX,
  floorMod,
  GAIN_MAX,
  GAIN_MIN,
  OPACITY_MAX,
  Q16_ONE,
  RATE_MAX,
  RATE_MIN,
  rampStep,
} from "./fixed";

export type DeckId = "A" | "B";
export type Direction = "forward" | "reverse";
export type ControlGrammar = "DJ" | "VJ";
export type LoopMode = "wrap" | "pingpong" | "hold";

export type Ramped = { valueQ16: number; targetQ16: number; startQ16: number; startTick: number };

export type EqBand = "LOW" | "MID" | "HI";

export type DeckState = {
  stackHash: string | null;
  durationTicks: number;
  loop: { startTick: number; endTickExclusive: number; mode: LoopMode };
  playheadQ17: bigint;
  playing: boolean;
  direction: Direction;
  rate: Ramped;
  opacity: Ramped;
  // EQ gains as ramped gainQ16 (§4.2 canonical, §6.1 8-tick ramp). Center = 1.0.
  eqLow: Ramped;
  eqMid: Ramped;
  eqHi: Ramped;
  cueTick: number;
  hotCues: (number | null)[];
};

export type InstrumentState = {
  tick: number;
  A: DeckState;
  B: DeckState;
  crossfader: Ramped;
  controlGrammar: ControlGrammar;
  previewDeck: DeckId;
};

const ramped = (valueQ16: number): Ramped => ({
  valueQ16,
  targetQ16: valueQ16,
  startQ16: valueQ16,
  startTick: 0,
});

function initialDeck(): DeckState {
  return {
    stackHash: null,
    durationTicks: 0,
    loop: { startTick: 0, endTickExclusive: 0, mode: "wrap" },
    playheadQ17: BigInt(0),
    playing: false,
    direction: "forward",
    rate: ramped(Q16_ONE),
    opacity: ramped(OPACITY_MAX),
    eqLow: ramped(Q16_ONE),
    eqMid: ramped(Q16_ONE),
    eqHi: ramped(Q16_ONE),
    cueTick: 0,
    hotCues: Array(8).fill(null),
  };
}

export function createInstrumentState(): InstrumentState {
  return {
    tick: 0,
    A: initialDeck(),
    B: initialDeck(),
    crossfader: ramped(0),
    controlGrammar: "DJ",
    previewDeck: "A",
  };
}

const tickToQ17 = (tick: number) => assertInt64(BigInt(tick) * BigInt(Q16_ONE), "playheadQ17");

// --- events ---------------------------------------------------------------

export type LoadedStack = {
  durationTicks: number;
  loop: { startTick: number; endTickExclusive: number; mode: LoopMode };
};

export type DeckEvent =
  | { type: "deck"; action: "load"; deck: DeckId; stackHash: string; stack: LoadedStack }
  | { type: "deck"; action: "eject"; deck: DeckId }
  | { type: "deck"; action: "channelOpacity"; deck: DeckId; valueQ16: number }
  | { type: "deck"; action: "crossfader"; valueQ16: number }
  | { type: "deck"; action: "setGrammar"; value: ControlGrammar }
  | { type: "deck"; action: "selectPreview"; deck: DeckId };

export type TransportEvent =
  | { type: "transport"; action: "playing"; deck: DeckId; value: boolean }
  | { type: "transport"; action: "rate"; deck: DeckId; valueQ16: number }
  | { type: "transport"; action: "direction"; deck: DeckId; value: Direction }
  | { type: "transport"; action: "cue"; deck: DeckId }
  | { type: "transport"; action: "setCue"; deck: DeckId; tick: number }
  | { type: "transport"; action: "hotCue"; deck: DeckId; index: number; op: "trigger" | "clear" }
  | { type: "transport"; action: "jogSeek"; deck: DeckId; deltaQ16Frames: number };

export type EqStateEvent = {
  type: "eq";
  deck: DeckId;
  band: EqBand;
  gainQ16: number;
};

export type InstrumentEvent = DeckEvent | TransportEvent | EqStateEvent;

const beginRamp = (r: Ramped, targetQ16: number, tick: number): Ramped => ({
  valueQ16: r.valueQ16,
  startQ16: r.valueQ16,
  targetQ16,
  startTick: tick,
});

function reduceDeck(state: InstrumentState, event: DeckEvent): InstrumentState {
  switch (event.action) {
    case "load": {
      const deck: DeckState = {
        ...initialDeck(),
        stackHash: event.stackHash,
        durationTicks: event.stack.durationTicks,
        loop: event.stack.loop,
        playheadQ17: tickToQ17(event.stack.loop.startTick),
      };
      return { ...state, [event.deck]: deck };
    }
    case "eject":
      return { ...state, [event.deck]: initialDeck() };
    case "channelOpacity": {
      assertRange(event.valueQ16, 0, OPACITY_MAX, "channelOpacity");
      const deck = state[event.deck];
      return { ...state, [event.deck]: { ...deck, opacity: beginRamp(deck.opacity, event.valueQ16, state.tick) } };
    }
    case "crossfader":
      assertRange(event.valueQ16, 0, CROSSFADER_MAX, "crossfader");
      return { ...state, crossfader: beginRamp(state.crossfader, event.valueQ16, state.tick) };
    case "setGrammar":
      // §7.1: only controlGrammar changes; everything else is invariant.
      return { ...state, controlGrammar: event.value };
    case "selectPreview":
      return { ...state, previewDeck: event.deck };
  }
}

function reduceTransport(state: InstrumentState, event: TransportEvent): InstrumentState {
  const deck = state[event.deck];
  switch (event.action) {
    case "playing":
      return { ...state, [event.deck]: { ...deck, playing: event.value } };
    case "rate":
      assertRange(event.valueQ16, RATE_MIN, RATE_MAX, "rate");
      return { ...state, [event.deck]: { ...deck, rate: beginRamp(deck.rate, event.valueQ16, state.tick) } };
    case "direction":
      return { ...state, [event.deck]: { ...deck, direction: event.value } };
    case "cue":
      return {
        ...state,
        [event.deck]: { ...deck, playing: false, playheadQ17: tickToQ17(deck.cueTick) },
      };
    case "setCue":
      return { ...state, [event.deck]: { ...deck, cueTick: event.tick } };
    case "hotCue": {
      const hotCues = deck.hotCues.slice();
      if (event.op === "clear") {
        hotCues[event.index] = null;
        return { ...state, [event.deck]: { ...deck, hotCues } };
      }
      const target = hotCues[event.index];
      if (target === null || target === undefined) return state;
      return { ...state, [event.deck]: { ...deck, playheadQ17: tickToQ17(target) } };
    }
    case "jogSeek": {
      const next = assertInt64(deck.playheadQ17 + BigInt(event.deltaQ16Frames) * BigInt(2), "jogSeek");
      return { ...state, [event.deck]: { ...deck, playheadQ17: wrapPlayhead(deck, next) } };
    }
  }
}

function reduceEq(state: InstrumentState, event: EqStateEvent): InstrumentState {
  assertRange(event.gainQ16, GAIN_MIN, GAIN_MAX, "eq gain");
  const deck = state[event.deck];
  const field = event.band === "LOW" ? "eqLow" : event.band === "MID" ? "eqMid" : "eqHi";
  return { ...state, [event.deck]: { ...deck, [field]: beginRamp(deck[field], event.gainQ16, state.tick) } };
}

export function reduceInstrument(state: InstrumentState, event: InstrumentEvent): InstrumentState {
  if (event.type === "deck") return reduceDeck(state, event);
  if (event.type === "eq") return reduceEq(state, event);
  return reduceTransport(state, event);
}

// --- per-tick advance -----------------------------------------------------

function wrapPlayhead(deck: DeckState, playheadQ17: bigint): bigint {
  const startQ17 = tickToQ17(deck.loop.startTick);
  const endQ17 = tickToQ17(deck.loop.endTickExclusive);
  const span = endQ17 - startQ17;
  if (span <= BigInt(0)) return playheadQ17;
  if (playheadQ17 >= startQ17 && playheadQ17 < endQ17) return playheadQ17;
  if (deck.loop.mode === "hold") {
    if (playheadQ17 >= endQ17) return endQ17 - BigInt(1);
    if (playheadQ17 < startQ17) return startQ17;
    return playheadQ17;
  }
  if (deck.loop.mode === "wrap") {
    return startQ17 + floorMod(playheadQ17 - startQ17, span);
  }
  // pingpong: reflect into [0, 2*span) then fold.
  const folded = floorMod(playheadQ17 - startQ17, span * BigInt(2));
  return folded < span ? startQ17 + folded : startQ17 + (span * BigInt(2) - BigInt(1) - folded);
}

/** Advances one simulation tick: ramps, then playhead (§6.1 steps 4–5). */
export function advanceInstrumentTick(state: InstrumentState): InstrumentState {
  const n = state.tick + 1;
  const step = (r: Ramped): Ramped => ({ ...r, valueQ16: rampStep(r.startQ16, r.targetQ16, r.startTick, n) });

  const advanceDeck = (deck: DeckState): DeckState => {
    const rate = step(deck.rate);
    const opacity = step(deck.opacity);
    let playheadQ17 = deck.playheadQ17;
    let direction = deck.direction;
    if (deck.playing && deck.stackHash) {
      const delta = BigInt(rate.valueQ16) * (direction === "forward" ? BigInt(1) : BigInt(-1));
      playheadQ17 = assertInt64(playheadQ17 + delta, "playheadQ17");
      // pingpong flips direction when it reflects off an edge.
      if (deck.loop.mode === "pingpong") {
        const endQ17 = tickToQ17(deck.loop.endTickExclusive);
        const startQ17 = tickToQ17(deck.loop.startTick);
        if (playheadQ17 >= endQ17) direction = "reverse";
        else if (playheadQ17 < startQ17) direction = "forward";
      }
      playheadQ17 = wrapPlayhead(deck, playheadQ17);
    }
    return {
      ...deck,
      rate,
      opacity,
      eqLow: step(deck.eqLow),
      eqMid: step(deck.eqMid),
      eqHi: step(deck.eqHi),
      playheadQ17,
      direction,
    };
  };

  return {
    ...state,
    tick: n,
    A: advanceDeck(state.A),
    B: advanceDeck(state.B),
    crossfader: step(state.crossfader),
  };
}

// --- program composite (§7.4) --------------------------------------------

export type DeckColor = { r: number; g: number; b: number; a: number };

/**
 * Linear-RGB premultiplied cross-dissolve. EQ-processed deck colours (CA,αA),
 * (CB,αB) with channel opacities oA/oB and crossfader x:
 *   wA = 1-x, wB = x
 *   Cprogram = clamp(wA·oA·CA + wB·oB·CB, 0, 1)
 *   αprogram = clamp(wA·oA·αA + wB·oB·αB, 0, 1)
 * An unloaded deck is treated as RGB/alpha 0.
 */
export function programComposite(
  state: InstrumentState,
  colorA: DeckColor | null,
  colorB: DeckColor | null,
): DeckColor {
  const x = state.crossfader.valueQ16 / Q16_ONE;
  const oA = state.A.opacity.valueQ16 / Q16_ONE;
  const oB = state.B.opacity.valueQ16 / Q16_ONE;
  const A = state.A.stackHash && colorA ? colorA : { r: 0, g: 0, b: 0, a: 0 };
  const B = state.B.stackHash && colorB ? colorB : { r: 0, g: 0, b: 0, a: 0 };
  const wA = 1 - x;
  const wB = x;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    r: clamp(wA * oA * A.r + wB * oB * B.r),
    g: clamp(wA * oA * A.g + wB * oB * B.g),
    b: clamp(wA * oA * A.b + wB * oB * B.b),
    a: clamp(wA * oA * A.a + wB * oB * B.a),
  };
}
