// FLX4 Web MIDI adapter — FISHVJ_INSTRUMENT_V1.md §5.
//
// Raw MIDI messages → validated semantic events on the existing bus (producer
// "midi"). 14-bit MSB/LSB faders are paired (a missing byte discards the pair,
// §5.4); a half-byte is never mixed with the previous value. Continuous lanes
// coalesce at an 8Hz flush boundary — absolute lanes last-write-wins, jog by
// signed sum of frame deltas. VJ vs DJ only changes which gesture a control
// means (§7); the mixer is grammar-invariant.
//
// Out of scope here (§5.1 bench-gated hardware): keepalive / SysEx, LED output,
// and real device I/O timing (F-B01..11). The instrument.bin archive track
// (§5.5) is a separate replay amendment.
import { gainQ16FromRaw14 } from "./eq";
import { encodeQ16 } from "./fixed";
import type { ControlGrammar, DeckId, InstrumentEvent } from "./transport";

export type EqBand = "LOW" | "MID" | "HI";

export type EqEvent = {
  type: "eq";
  deck: DeckId;
  band: EqBand;
  raw14: number;
  gainQ16: number;
  update: "absolute";
};

// A base-engine EngineEventInput (mode/scene/param/oneshot) that VJ pads emit.
export type BaseInput = {
  v: 1;
  producerId: "midi";
  type: string;
  payload: unknown;
};

export type AdapterEmission =
  | { kind: "instrument"; event: InstrumentEvent }
  | { kind: "eq"; event: EqEvent }
  | { kind: "base"; input: BaseInput };

// FLX4 raw map (§5.2). MSB CC → control; the LSB CC is MSB+0x20.
const FADER_CC: Record<number, { control: string }> = {
  0x00: { control: "tempo" },
  0x13: { control: "channelFader" },
  0x07: { control: "eqHI" },
  0x0b: { control: "eqMID" },
  0x0f: { control: "eqLOW" },
};

const clampU14 = (v: number) => Math.min(16383, Math.max(0, v));

// §5.3 curves.
const faderNorm = (raw: number) => raw / 16383;
function tempoRate(raw: number): number {
  return raw <= 8192 ? 0.5 + (0.5 * raw) / 8192 : 1 + (raw - 8192) / 8191;
}

const VJ_PAD_EVENT: Record<number, () => BaseInput> = {
  0: () => ({ v: 1, producerId: "midi", type: "mode", payload: { update: "absolute", value: "MYSTIC" } }),
  1: () => ({ v: 1, producerId: "midi", type: "mode", payload: { update: "absolute", value: "SENSUAL" } }),
  2: () => ({ v: 1, producerId: "midi", type: "mode", payload: { update: "absolute", value: "EUPHORIC" } }),
  3: () => ({ v: 1, producerId: "midi", type: "scene", payload: { update: "absolute", value: "MANDALA" } }),
  4: () => ({ v: 1, producerId: "midi", type: "scene", payload: { update: "absolute", value: "FREE_SWIM" } }),
};

type Pending14 = { msb?: number; lsb?: number };

export class Flx4Adapter {
  private grammar: ControlGrammar = "DJ";
  private pending = new Map<string, Pending14>();
  private absLane = new Map<string, AdapterEmission>();
  private jogLane = new Map<DeckId, number>(); // signed frame-delta accumulator (0.25-frame units summed as Q16 frames)
  private immediate: AdapterEmission[] = [];
  /** last raw source time, diagnostic only — never enters recording/reducer/hash (§5.4). */
  lastRawSourceT = 0;

  setGrammar(grammar: ControlGrammar) {
    this.grammar = grammar;
  }

  private deckOf(status: number): DeckId | null {
    const lo = status & 0x0f;
    return lo === 0 ? "A" : lo === 1 ? "B" : null;
  }

  /** Feeds one raw MIDI message. Continuous controls stage into lanes; discrete controls emit immediately. */
  feed(message: number[], rawSourceT = 0): void {
    this.lastRawSourceT = rawSourceT;
    const [status, d1, d2] = message;
    const hi = status & 0xf0;

    // Crossfader B6 1F/3F (14-bit, shared).
    if (status === 0xb6 && (d1 === 0x1f || d1 === 0x3f)) {
      this.feed14("X", "crossfader", d1 === 0x1f, d2);
      return;
    }

    if (hi === 0xb0) {
      const deck = this.deckOf(status);
      if (!deck) return;
      // 14-bit faders/knobs: MSB in FADER_CC, LSB = MSB + 0x20.
      const isLsb = d1 >= 0x20;
      const msbCC = isLsb ? d1 - 0x20 : d1;
      const spec = FADER_CC[msbCC];
      if (spec) {
        this.feed14(deck, spec.control, !isLsb, d2);
        return;
      }
      // 7-bit relative jog (center 0x40): B0 21/22/23/29.
      if (d1 === 0x21 || d1 === 0x22 || d1 === 0x23 || d1 === 0x29) {
        const delta = d2 - 0x40; // signed 7-bit relative
        const q16Frames = encodeQ16(delta * 0.25); // 0.25 frame/unit (§6.2)
        this.jogLane.set(deck, (this.jogLane.get(deck) ?? 0) + q16Frames);
        return;
      }
      return;
    }

    // Note-on transport / pads (90/91 deck, 97/99 pad, 98/9A shift pad).
    if (hi === 0x90) this.feedNote(status, d1, d2);
  }

  private feed14(laneDeck: DeckId | "X", control: string, isMsb: boolean, value: number) {
    const key = `${laneDeck}:${control}`;
    const p = this.pending.get(key) ?? {};
    if (isMsb) p.msb = value;
    else p.lsb = value;
    this.pending.set(key, p);
    if (p.msb === undefined || p.lsb === undefined) return; // wait for the pair (§5.4)
    const raw = clampU14((p.msb << 7) | p.lsb);
    this.pending.set(key, {}); // consumed
    this.stageAbsolute(laneDeck, control, raw);
  }

  private stageAbsolute(laneDeck: DeckId | "X", control: string, raw: number) {
    const key = `${laneDeck}:${control}`;
    if (control === "crossfader") {
      this.absLane.set(key, {
        kind: "instrument",
        event: { type: "deck", action: "crossfader", valueQ16: encodeQ16(faderNorm(raw)) },
      });
      return;
    }
    const deck = laneDeck as DeckId;
    if (control === "channelFader") {
      this.absLane.set(key, {
        kind: "instrument",
        event: { type: "deck", action: "channelOpacity", deck, valueQ16: encodeQ16(faderNorm(raw)) },
      });
    } else if (control === "tempo") {
      this.absLane.set(key, {
        kind: "instrument",
        event: { type: "transport", action: "rate", deck, valueQ16: encodeQ16(tempoRate(raw)) },
      });
    } else if (control === "eqHI" || control === "eqMID" || control === "eqLOW") {
      const band = control.slice(2) as EqBand;
      this.absLane.set(key, {
        kind: "eq",
        event: { type: "eq", deck, band, raw14: raw, gainQ16: gainQ16FromRaw14(raw), update: "absolute" },
      });
    }
  }

  private feedNote(status: number, note: number, velocity: number) {
    const press = velocity !== 0; // §5.2: 0 release, nonzero press; no velocity
    if (!press) return; // release emits no performance event
    const lo = status & 0x0f;

    // Transport 90/91: PLAY/PAUSE 0x0B, CUE 0x0C.
    if (lo === 0 || lo === 1) {
      const deck: DeckId = lo === 0 ? "A" : "B";
      if (note === 0x0b) {
        // DJ: immediate play toggle candidate (producer reads current state); VJ: launch/stop.
        this.immediate.push({
          kind: "instrument",
          event: { type: "transport", action: "playing", deck, value: this.grammar === "DJ" },
        });
        return;
      }
      if (note === 0x0c) {
        this.immediate.push({ kind: "instrument", event: { type: "transport", action: "cue", deck } });
        return;
      }
      return;
    }

    // Pads 97/99 (deck A/B) and shift pads 98/9A.
    const padDeck: DeckId | null = lo === 0x07 || lo === 0x08 ? "A" : lo === 0x09 || lo === 0x0a ? "B" : null;
    const shift = lo === 0x08 || lo === 0x0a;
    if (!padDeck || note < 0 || note > 7) return;

    if (this.grammar === "DJ") {
      this.immediate.push({
        kind: "instrument",
        event: { type: "transport", action: "hotCue", deck: padDeck, index: note, op: shift ? "clear" : "trigger" },
      });
      return;
    }
    // VJ: pads drive ShowState (deck A only per §5.3 pad table). Shift has no VJ meaning.
    if (shift) return;
    const factory = VJ_PAD_EVENT[note];
    if (factory) this.immediate.push({ kind: "base", input: factory() });
    // pads 6/7/8 (dive/blackout/reset) need current state to invert; the operator
    // console resolves those via toggleShowState below.
  }

  /**
   * Emits the coalesced events for a flush tick: immediate discrete events, then
   * absolute lanes in lane order, then jog signed sums. Absolute lanes are
   * last-write-wins; jog is a signed accumulator (a net-zero jog is dropped).
   */
  flush(): AdapterEmission[] {
    const out: AdapterEmission[] = [...this.immediate];
    this.immediate = [];
    for (const key of [...this.absLane.keys()].sort()) out.push(this.absLane.get(key)!);
    this.absLane.clear();
    for (const deck of [...this.jogLane.keys()].sort()) {
      const delta = this.jogLane.get(deck)!;
      if (delta !== 0) {
        out.push({ kind: "instrument", event: { type: "transport", action: "jogSeek", deck, deltaQ16Frames: delta } });
      }
    }
    this.jogLane.clear();
    return out;
  }
}
