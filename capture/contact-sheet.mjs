// Builds a downscaled contact sheet from one capture run so the full-resolution
// frames can stay out of git.
//
// Usage: node capture/contact-sheet.mjs --run run-1 [--columns 8] [--tile 234]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { decodePng, downscale, encodePng } from "./lib/png.mjs";

const ROOT = new URL("..", import.meta.url).pathname;

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const run = arg("run", "run-1");
const columns = Number(arg("columns", "8"));
const tileWidth = Number(arg("tile", "234"));
const manifest = JSON.parse(readFileSync(join(ROOT, "capture/manifest.json"), "utf8"));
const tileHeight = Math.round(
  (tileWidth * manifest.viewport.height) / manifest.viewport.width,
);
const gap = 2;

const rows = Math.ceil(manifest.captures.length / columns);
const width = columns * tileWidth + (columns + 1) * gap;
const height = rows * tileHeight + (rows + 1) * gap;
const sheet = Buffer.alloc(width * height * 4);
for (let index = 3; index < sheet.length; index += 4) sheet[index] = 255;

manifest.captures.forEach((point, index) => {
  const name = `tick-${String(point.tick).padStart(5, "0")}.png`;
  const tile = downscale(
    decodePng(readFileSync(join(ROOT, "capture/frames", run, name))),
    tileWidth,
    tileHeight,
  );
  const column = index % columns;
  const row = Math.floor(index / columns);
  const originX = gap + column * (tileWidth + gap);
  const originY = gap + row * (tileHeight + gap);
  for (let y = 0; y < tileHeight; y += 1) {
    const source = y * tileWidth * 4;
    const target = ((originY + y) * width + originX) * 4;
    tile.data.copy(sheet, target, source, source + tileWidth * 4);
  }
});

const target = join(ROOT, "capture", `contact-sheet-${run}.png`);
writeFileSync(target, encodePng({ width, height, data: sheet }));
console.log(
  `contact sheet: ${manifest.captures.length} frames, ${columns}×${rows} grid, ${width}×${height}px → ${target}`,
);
