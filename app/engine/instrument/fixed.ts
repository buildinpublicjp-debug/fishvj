// Instrument fixed-point math — FISHVJ_INSTRUMENT_V1.md §6.1.
//
// Q16 is Q16.16: encode(x)=floor(x*65536+0.5), decode(q)=q/65536, 1.0=65536.
// Playhead / beat / ramp intermediates are computed in signed 64-bit (BigInt
// here) and an overflow is a session error. floorDiv/floorMod/ceilDiv are the
// mathematical (not truncating) forms for b>0.
export const Q16_ONE = 65536;
export const CONTROL_RAMP_TICKS = 8;

// Signed 64-bit guard (§6.1 "overflowをsession errorとしてreject").
const INT64_MIN = -(BigInt(2) ** BigInt(63));
const INT64_MAX = BigInt(2) ** BigInt(63) - BigInt(1);

export function assertInt64(value: bigint, label = "value"): bigint {
  if (value < INT64_MIN || value > INT64_MAX) {
    throw new RangeError(`${label} overflowed signed 64-bit`);
  }
  return value;
}

export const encodeQ16 = (x: number) => Math.floor(x * Q16_ONE + 0.5);
export const decodeQ16 = (q: number) => q / Q16_ONE;

export function floorDiv(a: bigint, b: bigint): bigint {
  if (b <= BigInt(0)) throw new RangeError("floorDiv requires b > 0");
  const q = a / b;
  const r = a % b;
  return r !== BigInt(0) && r < BigInt(0) ? q - BigInt(1) : q;
}

export const ceilDiv = (a: bigint, b: bigint): bigint => -floorDiv(-a, b);
export const floorMod = (a: bigint, b: bigint): bigint => a - b * floorDiv(a, b);

/**
 * One step of the 8-tick integer linear ramp (§6.1). `k` is the tick the target
 * was applied; at tick `n` the interpolated value is
 * floor((start*(8-e) + target*e)/8) with e = clamp(n-k+1, 0, 8).
 */
export function rampStep(startQ16: number, targetQ16: number, k: number, n: number): number {
  const elapsed = Math.min(Math.max(n - k + 1, 0), CONTROL_RAMP_TICKS);
  const s = BigInt(startQ16);
  const t = BigInt(targetQ16);
  const e = BigInt(elapsed);
  const eight = BigInt(CONTROL_RAMP_TICKS);
  const value = floorDiv(s * (eight - e) + t * e, eight);
  return Number(assertInt64(value, "rampStep"));
}

// Canonical field ranges (§6.1). Reject out-of-range / non-canonical integers.
export const OPACITY_MIN = 0;
export const OPACITY_MAX = 65536;
export const CROSSFADER_MIN = 0;
export const CROSSFADER_MAX = 65536;
export const RATE_MIN = 32768; // 0.5x
export const RATE_MAX = 131072; // 2.0x
export const GAIN_MIN = 0;
export const GAIN_MAX = 131072; // 2.0x

export function assertRange(value: number, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be an integer in [${min}, ${max}]`);
  }
  return value;
}
