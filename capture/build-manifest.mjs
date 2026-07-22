// Generates capture/manifest.json.
//
// Coverage follows FISHVJ_DESIGN_V2.md §9.2: initial state, 3 modes, 2 scenes,
// 4 macros, 4 swarm/style values, 8 fish species, 4 movement types,
// min/default/max for every continuous param, DIVE enter/exit, BLACKOUT on/off,
// RESET, and the start / middle / end tick of each scene and swarm transition.
import { writeFileSync } from "node:fs";

const SWARM_TRANSITION_TICKS = 90; // app/engine/frame.ts

const events = [];
const captures = [];
let cursor = 0;

const advance = (ticks) => {
  cursor += ticks;
};
const event = (label, input) => events.push({ tick: cursor, label, input });
const capture = (label) => captures.push({ tick: cursor, label });

const mode = (value) => ({ v: 1, producerId: "ui", type: "mode", payload: { update: "absolute", value } });
const scene = (value) => ({ v: 1, producerId: "ui", type: "scene", payload: { update: "absolute", value } });
const macro = (value) => ({ v: 1, producerId: "ui", type: "macro", payload: { update: "absolute", value } });
const param = (payload) => ({ v: 1, producerId: "ui", type: "param", payload });
const absolute = (id, value) => param({ id, update: "absolute", value });
const fishSelection = (selectedSpecies, swimType) =>
  param({ id: "fishSelection", update: "atomic", selectedSpecies, swimType });
const reset = () => ({
  v: 1,
  producerId: "ui",
  type: "oneshot",
  payload: { id: "reset", update: "trigger" },
});

// --- initial state -------------------------------------------------------
capture("initial");
advance(30);
capture("default-settled");

// --- modes ---------------------------------------------------------------
for (const value of ["SENSUAL", "EUPHORIC", "MYSTIC"]) {
  advance(30);
  event(`mode-${value}`, mode(value));
  advance(2);
  capture(`mode-${value}-enter`);
  advance(28);
  capture(`mode-${value}-settled`);
}

// --- colour macros -------------------------------------------------------
for (const value of ["CLEAN", "ACID", "DEEP", "PUNCH"]) {
  advance(20);
  event(`macro-${value}`, macro(value));
  advance(10);
  capture(`macro-${value}`);
}

// --- swarm structures, with transition start / middle / end ---------------
for (const value of ["VORTEX", "WAVE", "BLOOM", "SPIRAL"]) {
  advance(30);
  event(`swarm-${value}`, absolute("swarm", value));
  advance(1);
  capture(`swarm-${value}-transition-start`);
  advance(SWARM_TRANSITION_TICKS / 2 - 1);
  capture(`swarm-${value}-transition-mid`);
  advance(SWARM_TRANSITION_TICKS / 2);
  capture(`swarm-${value}-transition-end`);
}

// --- 8 fish species (atomic species + movement) --------------------------
const SPECIES_MOTION = [
  "SCHOOL", // SARDINE
  "GLIDE", // TUNA
  "FLOAT", // BREAM
  "GLIDE", // SWORDFISH
  "FLOAT", // PUFFER
  "WAVE", // RIBBON
  "FLOAT", // ANGEL
  "SCHOOL", // MACKEREL
];
for (let index = 0; index < SPECIES_MOTION.length; index += 1) {
  advance(15);
  event(`species-${index}`, fishSelection(index, SPECIES_MOTION[index]));
  advance(5);
  capture(`species-${index}`);
}
advance(15);
event("species-0-restore", fishSelection(0, "SCHOOL"));
advance(5);
capture("species-0-restore");

// --- 4 movement types ----------------------------------------------------
for (const value of ["GLIDE", "WAVE", "FLOAT", "SCHOOL"]) {
  advance(15);
  event(`swim-${value}`, absolute("swimType", value));
  advance(5);
  capture(`swim-${value}`);
}

// --- continuous params: min / max / default ------------------------------
const RANGES = [
  ["fishCount", [100, 2000, 800]],
  ["fishSize", [0.5, 3, 1.5]],
  ["speed", [0.2, 1.6, 0.68]],
  ["depth", [0.15, 1, 0.74]],
  ["colorDrive", [0, 1, 0.72]],
];
for (const [id, values] of RANGES) {
  for (const value of values) {
    advance(20);
    event(`${id}-${value}`, absolute(id, value));
    advance(10);
    capture(`${id}-${value}`);
  }
}

// --- scene transition into FREE_SWIM -------------------------------------
advance(30);
event("scene-FREE_SWIM", scene("FREE_SWIM"));
advance(1);
capture("scene-FREE_SWIM-transition-start");
advance(29);
capture("scene-FREE_SWIM-transition-mid");
advance(90);
capture("scene-FREE_SWIM-transition-late");
advance(120);
capture("scene-FREE_SWIM-settled");

// --- free swim styles ----------------------------------------------------
for (const value of ["VORTEX", "WAVE", "BLOOM", "SPIRAL"]) {
  advance(30);
  event(`free-style-${value}`, absolute("swarm", value));
  advance(SWARM_TRANSITION_TICKS);
  capture(`free-style-${value}`);
}

// --- DIVE (SCHOOL RUSH) in free swim -------------------------------------
advance(30);
event("free-dive-enter", absolute("dive", true));
advance(1);
capture("free-dive-enter-start");
advance(44);
capture("free-dive-enter-mid");
advance(135);
capture("free-dive-enter-settled");
advance(30);
event("free-dive-exit", absolute("dive", false));
advance(1);
capture("free-dive-exit-start");
advance(179);
capture("free-dive-exit-settled");

// --- scene transition back to MANDALA ------------------------------------
advance(30);
event("scene-MANDALA", scene("MANDALA"));
advance(1);
capture("scene-MANDALA-transition-start");
advance(29);
capture("scene-MANDALA-transition-mid");
advance(180);
capture("scene-MANDALA-settled");

// --- DIVE (INFINITE DIVE) in mandala -------------------------------------
advance(30);
event("mandala-dive-enter", absolute("dive", true));
advance(1);
capture("mandala-dive-enter-start");
advance(44);
capture("mandala-dive-enter-mid");
advance(135);
capture("mandala-dive-enter-settled");
advance(30);
event("mandala-dive-exit", absolute("dive", false));
advance(180);
capture("mandala-dive-exit-settled");

// --- BLACKOUT ------------------------------------------------------------
advance(30);
event("blackout-on", absolute("blackout", true));
advance(10);
capture("blackout-on");
advance(30);
event("blackout-off", absolute("blackout", false));
advance(10);
capture("blackout-off");

// --- RESET from a drifted state ------------------------------------------
advance(30);
event("pre-reset-mode", mode("EUPHORIC"));
event("pre-reset-macro", macro("ACID"));
event("pre-reset-swarm", absolute("swarm", "BLOOM"));
event("pre-reset-fishCount", absolute("fishCount", 2000));
event("pre-reset-fishSize", absolute("fishSize", 3));
event("pre-reset-speed", absolute("speed", 1.6));
event("pre-reset-depth", absolute("depth", 1));
event("pre-reset-colorDrive", absolute("colorDrive", 1));
event("pre-reset-species", fishSelection(5, "WAVE"));
event("pre-reset-scene", scene("FREE_SWIM"));
event("pre-reset-dive", absolute("dive", true));
advance(150);
capture("pre-reset-drifted");
advance(30);
event("reset", reset());
advance(1);
capture("reset-start");
advance(29);
capture("reset-mid");
advance(210);
capture("reset-settled");

// Round the run length up so the final 30-tick hash sample is emitted.
const hashSampleEvery = 30;
const totalTicks = Math.ceil(cursor / hashSampleEvery) * hashSampleEvery;

const manifest = {
  version: 1,
  description:
    "FishVJ S1a determinism manifest. Covers FISHVJ_DESIGN_V2.md §9.2 control axes with transition start/mid/end ticks.",
  seed: 0x46495348,
  simHz: 60,
  hashSampleEvery,
  totalTicks,
  viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  audio: { kick: 0, bass: 0, high: 0 },
  events,
  captures,
};

const target = new URL("../capture/manifest.json", import.meta.url);
writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `manifest: ${events.length} events, ${captures.length} captures, ${totalTicks} ticks ` +
    `(${(totalTicks / manifest.simHz).toFixed(1)}s at ${manifest.simHz}Hz)`,
);
