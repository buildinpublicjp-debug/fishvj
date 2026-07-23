// Quantized launch / bar math — FISHVJ_INSTRUMENT_V1.md §6.3.
//
// A VJ PLAY reserves the ready preview state for the next bar boundary. The bar
// is derived from an unwrapped beat position built on canonicalized clock
// anchors (integer only, signed 64-bit), so live and replay compute the same
// target tick. All floats are canonicalized before entering the reducer.
import { assertInt64, ceilDiv, floorDiv, floorMod } from "./fixed";

const SIM_HZ = 60;
const BEATS_PER_BAR = 4;
const Q16 = 65536;
const BAR_Q16 = BigInt(BEATS_PER_BAR * Q16);
const SIXTY_SIMHZ = BigInt(60 * SIM_HZ); // 3600
export const CONFIDENCE_MIN_U16 = 32768; // canonical float 0.5

export type CanonicalClock = { bpmQ16: number; phaseQ16: number; confidenceU16: number };

/** Canonicalize a raw clock event before it reaches the reducer (§6.3). */
export function canonicalizeClock(bpm: number, phase: number, confidence: number): CanonicalClock {
  const phaseU16 = Math.floor(phase * 65535 + 0.5);
  const phaseQ16 = Math.min(65535, Math.floor((phaseU16 * 65536) / 65535 + 0.5));
  const bpmQ16 = Math.floor(bpm * 65536 + 0.5);
  const confidenceU16 = Math.floor(confidence * 65535 + 0.5);
  return { bpmQ16, phaseQ16, confidenceU16 };
}

export type BeatAnchor = { tick: number; phaseQ16: number; bpmQ16: number; beatAQ16: bigint };

/** First adopted anchor: beatAQ16 = phaseQ16A (§6.3). */
export function firstAnchor(tick: number, clock: CanonicalClock): BeatAnchor {
  return { tick, phaseQ16: clock.phaseQ16, bpmQ16: clock.bpmQ16, beatAQ16: BigInt(clock.phaseQ16) };
}

/** Unwrapped beat position at tick T under an anchor. */
export function beatQ16At(anchor: BeatAnchor, tick: number): bigint {
  const dt = BigInt(tick - anchor.tick);
  return assertInt64(
    anchor.beatAQ16 + floorDiv(dt * BigInt(anchor.bpmQ16), SIXTY_SIMHZ),
    "beatQ16",
  );
}

/**
 * Adopt a later anchor: choose the beatNQ16 whose low 16 bits are phaseQ16N and
 * that is nearest to the position predicted from the previous anchor; ties pick
 * the positive (larger) direction (§6.3).
 */
export function adoptAnchor(prev: BeatAnchor, tick: number, clock: CanonicalClock): BeatAnchor {
  const predicted = beatQ16At(prev, tick);
  const phase = BigInt(clock.phaseQ16);
  const base = predicted - floorMod(predicted, BigInt(Q16)) + phase;
  const candidates = [base - BigInt(Q16), base, base + BigInt(Q16)];
  let best = candidates[0];
  let bestDist = abs(best - predicted);
  for (const c of candidates.slice(1)) {
    const d = abs(c - predicted);
    if (d < bestDist || (d === bestDist && c > best)) {
      best = c;
      bestDist = d;
    }
  }
  return { tick, phaseQ16: clock.phaseQ16, bpmQ16: clock.bpmQ16, beatAQ16: best };
}

const abs = (v: bigint) => (v < BigInt(0) ? -v : v);

export type Reservation = {
  reserveTick: number;
  beatRQ16: bigint;
  targetBeatQ16: bigint;
  targetTick: number;
};

/**
 * Reserve the next 4-beat boundary strictly after the reserve tick. If the clock
 * confidence is below 0.5 (canonical 32768) there is no reliable bar, so the
 * launch fires on the next simulation tick.
 */
export function reserveLaunch(
  anchor: BeatAnchor,
  reserveTick: number,
  confidenceU16: number,
): Reservation {
  const beatRQ16 = beatQ16At(anchor, reserveTick);
  if (confidenceU16 < CONFIDENCE_MIN_U16) {
    return { reserveTick, beatRQ16, targetBeatQ16: beatRQ16, targetTick: reserveTick + 1 };
  }
  const targetBeatQ16 = BAR_Q16 * (floorDiv(beatRQ16, BAR_Q16) + BigInt(1));
  const targetTick =
    anchor.tick +
    Number(
      ceilDiv((targetBeatQ16 - anchor.beatAQ16) * SIXTY_SIMHZ, BigInt(anchor.bpmQ16)),
    );
  return { reserveTick, beatRQ16, targetBeatQ16, targetTick };
}
