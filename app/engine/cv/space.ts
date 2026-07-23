// SpaceState CV v0 processing — FISHVJ_DESIGN_V2.md §10.1.
//
// The fixed WebGL path (camera texture + matching history frame → homography
// warp → global RGB gain/bias → absdiff → threshold + 3×3 cleanup → residual
// mask → 8×8 density grid + energy + silhouette ratio) expressed as pure
// functions. This is the software reference; the GPU passes and the real camera
// / projector / lag measurement are hardware-gated (§10.5, §10.6).
export type RgbaImage = { width: number; height: number; data: Uint8Array };
export type Mask = { width: number; height: number; data: Uint8Array }; // 0/1
export type SpaceGrid = { grid: Uint8Array; energy: number; silRatio: number }; // grid length 64

const clampU8 = (v: number) => Math.min(255, Math.max(0, Math.round(v)));

/** Global RGB gain/bias correction (§10.1 color correction). */
export function rgbGainBias(
  img: RgbaImage,
  gain: [number, number, number],
  bias: [number, number, number],
): RgbaImage {
  const out = new Uint8Array(img.data.length);
  for (let i = 0; i < img.data.length; i += 4) {
    out[i] = clampU8(img.data[i] * gain[0] + bias[0]);
    out[i + 1] = clampU8(img.data[i + 1] * gain[1] + bias[1]);
    out[i + 2] = clampU8(img.data[i + 2] * gain[2] + bias[2]);
    out[i + 3] = img.data[i + 3];
  }
  return { width: img.width, height: img.height, data: out };
}

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Grayscale absolute difference between a camera frame and its history match. */
export function absdiffGray(a: RgbaImage, b: RgbaImage): Uint8Array {
  if (a.width !== b.width || a.height !== b.height) throw new RangeError("absdiff size mismatch");
  const out = new Uint8Array(a.width * a.height);
  for (let i = 0, p = 0; i < out.length; i += 1, p += 4) {
    out[i] = clampU8(Math.abs(luma(a.data[p], a.data[p + 1], a.data[p + 2]) - luma(b.data[p], b.data[p + 1], b.data[p + 2])));
  }
  return out;
}

/** Threshold a grayscale diff into a binary mask. */
export function threshold(diff: Uint8Array, width: number, height: number, t: number): Mask {
  const data = new Uint8Array(diff.length);
  for (let i = 0; i < diff.length; i += 1) data[i] = diff[i] >= t ? 1 : 0;
  return { width, height, data };
}

/** 3×3 majority cleanup (removes speckle; ≥5 of 9 neighbours on → on). */
export function cleanup3x3(mask: Mask): Mask {
  const { width: w, height: h, data } = mask;
  const out = new Uint8Array(data.length);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const sx = Math.min(w - 1, Math.max(0, x + dx));
          const sy = Math.min(h - 1, Math.max(0, y + dy));
          count += data[sy * w + sx];
        }
      }
      out[y * w + x] = count >= 5 ? 1 : 0;
    }
  }
  return { width: w, height: h, data: out };
}

/** 8×8 density grid + energy + silhouette ratio → SpacePayload scalars (§4.3). */
export function aggregate8x8(mask: Mask): SpaceGrid {
  const { width: w, height: h, data } = mask;
  const grid = new Uint8Array(64);
  let onTotal = 0;
  for (let cy = 0; cy < 8; cy += 1) {
    for (let cx = 0; cx < 8; cx += 1) {
      const x0 = Math.floor((cx * w) / 8);
      const x1 = Math.floor(((cx + 1) * w) / 8);
      const y0 = Math.floor((cy * h) / 8);
      const y1 = Math.floor(((cy + 1) * h) / 8);
      let on = 0;
      let cells = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          on += data[y * w + x];
          cells += 1;
        }
      }
      grid[cy * 8 + cx] = cells ? clampU8((on / cells) * 255) : 0;
      onTotal += on;
    }
  }
  const total = w * h;
  const energy = clampU8((grid.reduce((s, v) => s + v, 0) / 64));
  const silRatio = clampU8((onTotal / total) * 255);
  return { grid, energy, silRatio };
}

/**
 * Encodes a simulation tick as a binary strip along the top row (§10.5 frame ID)
 * so the camera can decode which output frame it observed. `bits` cells across.
 */
export function encodeFrameId(img: RgbaImage, tick: number, bits = 16): RgbaImage {
  const out = { width: img.width, height: img.height, data: Uint8Array.from(img.data) };
  const cellW = Math.max(1, Math.floor(img.width / bits));
  for (let bit = 0; bit < bits; bit += 1) {
    const value = (tick >> bit) & 1 ? 255 : 0;
    for (let x = bit * cellW; x < (bit + 1) * cellW && x < img.width; x += 1) {
      const p = x * 4; // row 0
      out.data[p] = value;
      out.data[p + 1] = value;
      out.data[p + 2] = value;
      out.data[p + 3] = 255;
    }
  }
  return out;
}

export function decodeFrameId(img: RgbaImage, bits = 16): number {
  const cellW = Math.max(1, Math.floor(img.width / bits));
  let tick = 0;
  for (let bit = 0; bit < bits; bit += 1) {
    const x = Math.min(img.width - 1, bit * cellW + (cellW >> 1));
    if (img.data[x * 4] >= 128) tick |= 1 << bit;
  }
  return tick;
}
