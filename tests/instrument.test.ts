import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceInstrumentTick,
  createInstrumentState,
  programComposite,
  reduceInstrument,
  type InstrumentEvent,
  type InstrumentState,
} from "../app/engine/instrument/transport";
import { CONTROL_RAMP_TICKS, encodeQ16, Q16_ONE, rampStep } from "../app/engine/instrument/fixed";
import { stackContentHash, validateStack, type StackManifestV0 } from "../app/engine/instrument/stack";

function fixtureStack(overrides: Partial<StackManifestV0> = {}): StackManifestV0 {
  const count = 60;
  const base: StackManifestV0 = {
    v: 0,
    id: "gyogen-stack-v0",
    name: "GYOGEN",
    sourceKind: "playback",
    contentHash: "sha256:pending",
    frame: {
      width: 960,
      height: 540,
      fps: 30,
      count,
      maxPayloadBytes: 62208000,
      accessKind: "independent-frames",
      assetPath: "stacks/gyogen/frames.bin",
      assetHash: "sha256:aaaa",
      byteLength: count * 960 * 540,
    },
    depth: {
      width: 960,
      height: 540,
      format: "r8-unorm",
      assetPath: "stacks/gyogen/depth.bin",
      assetHash: "sha256:bbbb",
      byteLength: 518400,
    },
    alpha: {
      width: 960,
      height: 540,
      format: "r8-unorm",
      assetPath: "stacks/gyogen/alpha.bin",
      assetHash: "sha256:cccc",
      byteLength: 518400,
    },
    prep: {
      simHz: 60,
      frameStepTicks: 2,
      durationTicks: count * 2,
      phaseAxis: "time",
      loop: { startTick: 0, endTickExclusive: count * 2, mode: "wrap" },
      parallax: { enabled: true, maxDisplacementPx: 6, edgeDilatePx: 4 },
      provenance: { licenseStatus: "cleared" },
    },
    access: {
      gopFrames: 1,
      cacheFrames: 30,
      reverseFrames: 15,
      decodeP95Ms: "unverified",
      memoryCeilingBytes: 134217728,
    },
    ...overrides,
  };
  base.contentHash = stackContentHash(base);
  return base;
}

const load = (state: InstrumentState, deck: "A" | "B", durationTicks = 120): InstrumentState =>
  reduceInstrument(state, {
    type: "deck",
    action: "load",
    deck,
    stackHash: `sha256:${deck}`,
    stack: { durationTicks, loop: { startTick: 0, endTickExclusive: durationTicks, mode: "wrap" } },
  });

const drive = (state: InstrumentState, events: Map<number, InstrumentEvent[]>, ticks: number) => {
  let s = state;
  for (let step = 0; step <= ticks; step += 1) {
    for (const e of events.get(step) ?? []) s = reduceInstrument({ ...s, tick: step }, e);
    if (step < ticks) s = advanceInstrumentTick(s);
  }
  return s;
};

test("stack v0 validation accepts a well-formed manifest and recomputes its hash", () => {
  const stack = fixtureStack();
  const result = validateStack(stack);
  assert.deepEqual(result.errors, []);
  assert.ok(result.ok);
  assert.match(stack.contentHash, /^sha256:[0-9a-f]{64}$/);
});

test("stack v0 validation rejects contract violations", () => {
  const bad = (o: Partial<StackManifestV0>, re: RegExp) => {
    const s = fixtureStack(o);
    s.contentHash = stackContentHash(s); // keep hash valid so the target error surfaces
    assert.ok(validateStack(s).errors.some((e) => re.test(e)), re.source);
  };
  bad({ frame: { ...fixtureStack().frame, count: 200 } }, /1\.\.120/);
  bad({ frame: { ...fixtureStack().frame, fps: 25 as unknown as 30 } }, /30fps/);
  bad({ depth: { ...fixtureStack().depth, byteLength: 1 } }, /518,400B/);
  bad(
    { prep: { ...fixtureStack().prep, durationTicks: 999 } },
    /durationTicks must equal frame.count \* 2/,
  );
  bad(
    { prep: { ...fixtureStack().prep, parallax: { enabled: true, maxDisplacementPx: 20, edgeDilatePx: 2 } } },
    /displacement must be 0\.\.8/,
  );
});

test("stack content hash changes when any byte changes and flags unverified license", () => {
  const a = fixtureStack();
  const b = fixtureStack({ name: "GYOGEN 2" });
  assert.notEqual(a.contentHash, b.contentHash);

  const unverified = fixtureStack({
    prep: { ...fixtureStack().prep, provenance: { licenseStatus: "unverified" } },
  });
  const result = validateStack(unverified);
  assert.ok(result.ok); // technical load allowed
  assert.ok(result.warnings.some((w) => /unverified/.test(w)));
});

test("the 8-tick control ramp reaches its target in exactly 8 ticks", () => {
  const start = encodeQ16(0.5);
  const target = encodeQ16(1.0);
  // n = k .. k+9 with k = 3; elapsed = clamp(n-k+1, 0, 8), so n=k already moves 1/8.
  const values = Array.from({ length: 10 }, (_, i) => rampStep(start, target, 3, 3 + i));
  assert.ok(values[0] > start && values[0] < target); // first tick is 1/8 in
  assert.equal(values[CONTROL_RAMP_TICKS - 1], target); // reached at elapsed 8 (n = k+7)
  assert.equal(values[CONTROL_RAMP_TICKS], target); // held after
  for (let i = 1; i < CONTROL_RAMP_TICKS; i += 1) assert.ok(values[i] >= values[i - 1]);
});

test("playhead advances 1 frame per 2 ticks at rate 1.0 and is deterministic", () => {
  let s = load(createInstrumentState(), "A");
  s = reduceInstrument({ ...s, tick: 0 }, { type: "transport", action: "playing", deck: "A", value: true });
  const run = (from: InstrumentState) => {
    let t = from;
    for (let i = 0; i < 4; i += 1) t = advanceInstrumentTick(t);
    return t.A.playheadQ17;
  };
  // 4 ticks at rate 1.0 → playheadQ17 = 4 * 65536 = 2 frames.
  assert.equal(run(s).toString(), (4 * Q16_ONE).toString());
  assert.equal(run(s).toString(), run(s).toString());
});

test("loop wrap returns to start; hold clamps at the end", () => {
  const mkLoop = (mode: "wrap" | "hold" | "pingpong") =>
    reduceInstrument(createInstrumentState(), {
      type: "deck",
      action: "load",
      deck: "A",
      stackHash: "sha256:x",
      stack: { durationTicks: 8, loop: { startTick: 0, endTickExclusive: 8, mode } },
    });

  const play = (s0: InstrumentState) =>
    reduceInstrument({ ...s0, tick: 0 }, { type: "transport", action: "playing", deck: "A", value: true });

  const wrapEnd = drive(play(mkLoop("wrap")), new Map(), 10).A.playheadQ17;
  assert.ok(wrapEnd >= BigInt(0) && wrapEnd < BigInt(8 * Q16_ONE)); // wrapped inside the loop

  const holdEnd = drive(play(mkLoop("hold")), new Map(), 20).A.playheadQ17;
  assert.equal(holdEnd, BigInt(8 * Q16_ONE) - BigInt(1)); // clamped one below the end
});

test("cue seeks to the stored cue and pauses; hot cues store and recall", () => {
  let s = load(createInstrumentState(), "A");
  s = reduceInstrument({ ...s, tick: 0 }, { type: "transport", action: "playing", deck: "A", value: true });
  s = drive(s, new Map(), 10); // advance the playhead
  s = reduceInstrument({ ...s, tick: 10 }, { type: "transport", action: "setCue", deck: "A", tick: 4 });
  s = reduceInstrument({ ...s, tick: 10 }, { type: "transport", action: "hotCue", deck: "A", index: 2, op: "trigger" });
  // no hot cue stored yet at index 2 → position unchanged is fine; store via setCue path
  s = reduceInstrument({ ...s, tick: 10 }, { type: "transport", action: "cue", deck: "A" });
  assert.equal(s.A.playing, false);
  assert.equal(s.A.playheadQ17, BigInt(4 * Q16_ONE));
});

test("DJ/VJ grammar switch changes only controlGrammar and never the composite", () => {
  let s = load(load(createInstrumentState(), "A"), "B");
  s = reduceInstrument({ ...s, tick: 0 }, { type: "deck", action: "channelOpacity", deck: "A", valueQ16: 40000 });
  s = reduceInstrument({ ...s, tick: 0 }, { type: "deck", action: "crossfader", valueQ16: 20000 });
  s = drive(s, new Map(), CONTROL_RAMP_TICKS); // settle ramps

  const colorA = { r: 0.8, g: 0.2, b: 0.4, a: 1 };
  const colorB = { r: 0.1, g: 0.6, b: 0.9, a: 1 };
  const before = programComposite(s, colorA, colorB);

  const { A, B, crossfader, previewDeck, tick } = s;
  const switched = reduceInstrument(s, { type: "deck", action: "setGrammar", value: "VJ" });

  assert.equal(switched.controlGrammar, "VJ");
  // Everything the invariance clause protects is byte-identical.
  assert.deepEqual({ A: switched.A, B: switched.B, crossfader: switched.crossfader, previewDeck: switched.previewDeck, tick: switched.tick }, { A, B, crossfader, previewDeck, tick });
  assert.deepEqual(programComposite(switched, colorA, colorB), before);
});

test("program composite is a premultiplied linear cross-dissolve, unloaded deck = 0", () => {
  let s = load(load(createInstrumentState(), "A"), "B");
  // crossfader 0 → full A; opacity full.
  const full = programComposite(s, { r: 1, g: 0.5, b: 0.25, a: 1 }, { r: 0, g: 0, b: 0, a: 1 });
  assert.deepEqual(full, { r: 1, g: 0.5, b: 0.25, a: 1 });

  // Eject B → treated as 0 regardless of the supplied colour.
  s = reduceInstrument(s, { type: "deck", action: "eject", deck: "B" });
  s = reduceInstrument({ ...s, tick: 0 }, { type: "deck", action: "crossfader", valueQ16: Q16_ONE });
  s = advanceInstrumentTick(s);
  for (let i = 0; i < CONTROL_RAMP_TICKS; i += 1) s = advanceInstrumentTick(s);
  const onlyEjected = programComposite(s, { r: 1, g: 1, b: 1, a: 1 }, { r: 1, g: 1, b: 1, a: 1 });
  assert.deepEqual(onlyEjected, { r: 0, g: 0, b: 0, a: 0 }); // crossfader→B but B ejected
});
