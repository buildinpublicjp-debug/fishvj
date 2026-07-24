import assert from "node:assert/strict";
import test from "node:test";

import { applyHomography, solveHomography, type Point } from "../app/engine/cv/homography";
import {
  absdiffGray,
  aggregate8x8,
  cleanup3x3,
  decodeFrameId,
  encodeFrameId,
  rgbGainBias,
  threshold,
  type RgbaImage,
} from "../app/engine/cv/space";
import { HistoryRing, RING_FRAMES, RING_HEIGHT, RING_WIDTH } from "../app/engine/cv/ring";

function solidImage(w: number, h: number, rgb: [number, number, number]): RgbaImage {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}

test("homography maps the four calibration corners exactly", () => {
  const src: Point[] = [
    { x: 0, y: 0 },
    { x: 1920, y: 0 },
    { x: 1920, y: 1080 },
    { x: 0, y: 1080 },
  ];
  const dst: Point[] = [
    { x: 100, y: 80 },
    { x: 1200, y: 60 },
    { x: 1250, y: 700 },
    { x: 130, y: 720 },
  ];
  const h = solveHomography(src, dst);
  for (let i = 0; i < 4; i += 1) {
    const p = applyHomography(h, src[i]);
    assert.ok(Math.abs(p.x - dst[i].x) < 1e-6 && Math.abs(p.y - dst[i].y) < 1e-6);
  }
  // an interior point stays finite and inside the mapped quad's bounds
  const mid = applyHomography(h, { x: 960, y: 540 });
  assert.ok(mid.x > 100 && mid.x < 1250 && mid.y > 60 && mid.y < 720);
});

test("RGB gain/bias corrects channels and clamps", () => {
  const img = solidImage(2, 2, [100, 50, 200]);
  const out = rgbGainBias(img, [1.5, 2, 1], [0, 0, 100]);
  assert.equal(out.data[0], 150);
  assert.equal(out.data[1], 100);
  assert.equal(out.data[2], 255); // 200 + 100 clamped
});

test("no-person: identical frames yield near-zero residual occupancy", () => {
  const frame = solidImage(64, 64, [120, 120, 120]);
  const diff = absdiffGray(frame, frame);
  const mask = cleanup3x3(threshold(diff, 64, 64, 20));
  const { energy, silRatio } = aggregate8x8(mask);
  assert.equal(energy, 0);
  assert.equal(silRatio, 0);
});

test("known rectangle occluder produces a mask with IoU >= 0.60", () => {
  const w = 64;
  const h = 64;
  const bg = solidImage(w, h, [40, 40, 40]);
  const cur = solidImage(w, h, [40, 40, 40]);
  // paint a bright rectangle [16..48) x [16..48) into the current frame
  const inRect = (x: number, y: number) => x >= 16 && x < 48 && y >= 16 && y < 48;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (inRect(x, y)) {
        const p = (y * w + x) * 4;
        cur.data[p] = cur.data[p + 1] = cur.data[p + 2] = 220;
      }
    }
  }
  const mask = cleanup3x3(threshold(absdiffGray(cur, bg), w, h, 30));
  let inter = 0;
  let union = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const gt = inRect(x, y) ? 1 : 0;
      const m = mask.data[y * w + x];
      if (gt && m) inter += 1;
      if (gt || m) union += 1;
    }
  }
  assert.ok(inter / union >= 0.6, `IoU ${inter / union}`);
});

test("8x8 aggregation reports a half-covered frame at ~50% silhouette", () => {
  const w = 64;
  const h = 64;
  const mask = { width: w, height: h, data: new Uint8Array(w * h) };
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w / 2; x += 1) mask.data[y * w + x] = 1;
  const { grid, silRatio } = aggregate8x8(mask);
  assert.equal(grid.length, 64);
  assert.equal(grid[0], 255); // fully-on cell (left)
  assert.equal(grid[7], 0); // fully-off cell (right)
  assert.ok(Math.abs(silRatio - 128) <= 2);
});

test("frame ID survives an encode/decode round trip", () => {
  const img = solidImage(512, 4, [10, 10, 10]);
  for (const tick of [0, 1, 42, 3600, 65535]) {
    assert.equal(decodeFrameId(encodeFrameId(img, tick)), tick);
  }
});

test("history ring selects the slot at a given lag and rejects over-ring lag", () => {
  const ring = new HistoryRing();
  assert.equal(ring.byteLength, RING_WIDTH * RING_HEIGHT * 4 * RING_FRAMES);
  for (let tick = 0; tick < RING_FRAMES; tick += 1) {
    ring.push(solidImage(RING_WIDTH, RING_HEIGHT, [tick, 0, 0]), tick);
  }
  assert.equal(ring.slotForLag(0)?.tick, RING_FRAMES - 1); // most recent
  assert.equal(ring.slotForLag(3)?.tick, RING_FRAMES - 4);
  assert.equal(ring.slotForLag(RING_FRAMES), null); // beyond the ring → escalate
});
