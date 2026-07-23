// Shared replay dictionaries and manifest shape — FISHVJ_DESIGN_V2.md §6.2.
import { TICK_MS } from "../types";

export const PRODUCERS = [
  "keys",
  "ui",
  "midi",
  "audio",
  "replay",
  "cv",
  "sim",
  "djlink",
  "bot",
] as const;

// Control event types. `beat` here is the clock variant; band samples go to the
// audio binary track, not control.json.
export const CONTROL_TYPES = ["mode", "scene", "macro", "param", "oneshot", "verb", "beat"] as const;

export const PARAMS = [
  "colorDrive",
  "fishCount",
  "fishSize",
  "speed",
  "depth",
  "dive",
  "blackout",
  "swimType",
  "swarm",
  "fishSelection",
] as const;

export const MODES = ["MYSTIC", "SENSUAL", "EUPHORIC"] as const;
export const SCENES = ["MANDALA", "FREE_SWIM"] as const;
export const COLORS = ["CLEAN", "PUNCH", "ACID", "DEEP"] as const;
export const SWIMS = ["SCHOOL", "GLIDE", "WAVE", "FLOAT"] as const;
export const SWARMS = ["SPIRAL", "VORTEX", "WAVE", "BLOOM"] as const;

// Fixed-point scales for control quantization, matched to the §5.3 hash scales
// so a replayed value hashes identically to the value that was recorded.
export const SCALE_NORM = 65535;
export const SCALE_MILLI = 1000;

export const BUDGET_TOTAL_PER_MIN = 60000;
export const BUDGET_CONTROL_PER_MIN = 28000;
export const TICKS_PER_MIN = 60 * (1000 / TICK_MS);

export type ReplayManifest = {
  v: 1;
  engine: string;
  deckId: string;
  deckHash: string;
  atlasHash: string;
  seed: number;
  simHz: number;
  audioHz: number;
  spaceHz: number;
  firstSourceT: number;
  durationTicks: number;
  producers: string[];
  types: string[];
  params: string[];
};

export const sourceTickOf = (sourceT: number, firstSourceT: number) =>
  Math.round((sourceT - firstSourceT) / TICK_MS);
