// Spatial-frequency EQ — FISHVJ_INSTRUMENT_V1.md §4.
//
// A 3-band split from a Gaussian pyramid on linear-RGB premultiplied colour:
//   G0 = I, G1 = P(G0), G2 = P(G1)
//   HI = G0 - G1, MID = G1 - G2, LOW = G2
//   O  = clamp(gLOW·LOW + gMID·MID + gHI·HI)
// P is reduce (5-tap binomial [1,4,6,4,1]/16, mirror edge, 2:1 downsample) then
// expand back to full resolution. This module is the *software reference* the
// §4.4 acceptance is measured against; the GPU shader is a faithful port.
import { encodeQ16 } from "./fixed";

export type EqBand = "LOW" | "MID" | "HI";
export type FloatImage = { width: number; height: number; data: Float32Array }; // RGBA, premultiplied linear

const KERNEL = [1, 4, 6, 4, 1];
const KERNEL_SUM = 16;

/** FLX4 14-bit knob → gain (§4.2 piecewise): 0→0, 8192→1, 16383→2. */
export function gainFromRaw14(raw14: number): number {
  if (!Number.isInteger(raw14) || raw14 < 0 || raw14 > 16383) {
    throw new RangeError("EQ raw14 must be an integer 0..16383");
  }
  return raw14 <= 8192 ? raw14 / 8192 : 1 + (raw14 - 8192) / 8191;
}

export const gainQ16FromRaw14 = (raw14: number) => encodeQ16(gainFromRaw14(raw14));

const mirror = (i: number, n: number) => {
  // reflect-101 mirror edge
  if (n === 1) return 0;
  let m = i;
  while (m < 0 || m >= n) {
    if (m < 0) m = -m;
    if (m >= n) m = 2 * (n - 1) - m;
  }
  return m;
};

function blur1D(src: Float32Array, w: number, h: number, horizontal: boolean): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      for (let c = 0; c < 4; c += 1) {
        let acc = 0;
        for (let k = -2; k <= 2; k += 1) {
          const sx = horizontal ? mirror(x + k, w) : x;
          const sy = horizontal ? y : mirror(y + k, h);
          acc += src[(sy * w + sx) * 4 + c] * KERNEL[k + 2];
        }
        out[(y * w + x) * 4 + c] = acc / KERNEL_SUM;
      }
    }
  }
  return out;
}

const blur = (img: FloatImage): Float32Array =>
  blur1D(blur1D(img.data, img.width, img.height, true), img.width, img.height, false);

/** reduce: blur then drop every other sample (2:1). */
function reduce(img: FloatImage): FloatImage {
  const blurred = blur(img);
  const w2 = Math.max(1, Math.floor(img.width / 2));
  const h2 = Math.max(1, Math.floor(img.height / 2));
  const out = new Float32Array(w2 * h2 * 4);
  for (let y = 0; y < h2; y += 1) {
    for (let x = 0; x < w2; x += 1) {
      for (let c = 0; c < 4; c += 1) {
        out[(y * w2 + x) * 4 + c] = blurred[(y * 2 * img.width + x * 2) * 4 + c];
      }
    }
  }
  return { width: w2, height: h2, data: out };
}

/** expand: nearest-upsample to (w,h) then blur (reconstruct to full resolution). */
function expand(img: FloatImage, w: number, h: number): FloatImage {
  const up = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(img.width - 1, x >> 1);
      const sy = Math.min(img.height - 1, y >> 1);
      for (let c = 0; c < 4; c += 1) up[(y * w + x) * 4 + c] = img.data[(sy * img.width + sx) * 4 + c];
    }
  }
  return { width: w, height: h, data: blur({ width: w, height: h, data: up }) };
}

const pyramidUp = (img: FloatImage): FloatImage => expand(reduce(img), img.width, img.height);

/**
 * Applies the 3-band EQ. `gains` are the decoded gLOW/gMID/gHI. Alpha is not
 * frequency-split: the reconstructed RGB carries the input alpha (§4.1).
 */
export function applyEq(
  input: FloatImage,
  gains: { LOW: number; MID: number; HI: number },
): FloatImage {
  const g0 = input;
  const g1 = pyramidUp(g0);
  const g2 = pyramidUp(g1);
  const n = input.width * input.height;
  const out = new Float32Array(input.data.length);
  for (let i = 0; i < n; i += 1) {
    for (let c = 0; c < 3; c += 1) {
      const idx = i * 4 + c;
      const low = g2.data[idx];
      const mid = g1.data[idx] - g2.data[idx];
      const hi = g0.data[idx] - g1.data[idx];
      out[idx] = Math.min(1, Math.max(0, gains.LOW * low + gains.MID * mid + gains.HI * hi));
    }
    out[i * 4 + 3] = input.data[i * 4 + 3]; // alpha unchanged
  }
  return { width: input.width, height: input.height, data: out };
}
