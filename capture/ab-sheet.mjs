// Composites the manual A/B set into one sheet: base commit on the left,
// agent/fishvj-s1a-ssot on the right, one row per control axis.
//
// Usage: node capture/ab-sheet.mjs [--left base] [--right s1a] [--tile 480]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { decodePng, downscale, encodePng } from "./lib/png.mjs";
import { STATES } from "./lib/ab-states.mjs";

const ROOT = new URL("..", import.meta.url).pathname;

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const left = arg("left", "base");
const right = arg("right", "s1a");
const tileWidth = Number(arg("tile", "480"));
const tileHeight = Math.round((tileWidth * 1080) / 1920);
const gap = 4;

const width = 2 * tileWidth + 3 * gap;
const height = STATES.length * tileHeight + (STATES.length + 1) * gap;
const sheet = Buffer.alloc(width * height * 4);
for (let index = 3; index < sheet.length; index += 4) sheet[index] = 255;

const place = (tile, originX, originY) => {
  for (let y = 0; y < tileHeight; y += 1) {
    const source = y * tileWidth * 4;
    const target = ((originY + y) * width + originX) * 4;
    tile.data.copy(sheet, target, source, source + tileWidth * 4);
  }
};

STATES.forEach((state, row) => {
  const originY = gap + row * (tileHeight + gap);
  [left, right].forEach((variant, column) => {
    const source = decodePng(
      readFileSync(join(ROOT, "capture/ab", variant, `${state.label}.png`)),
    );
    place(downscale(source, tileWidth, tileHeight), gap + column * (tileWidth + gap), originY);
  });
});

const target = join(ROOT, "capture", `ab-sheet-${left}-vs-${right}.png`);
writeFileSync(target, encodePng({ width, height, data: sheet }));
console.log(
  `A/B sheet: ${STATES.length} rows (${left} | ${right}), ${width}×${height}px → ${target}`,
);
console.log(STATES.map((state, index) => `  row ${index + 1}: ${state.label}`).join("\n"));
