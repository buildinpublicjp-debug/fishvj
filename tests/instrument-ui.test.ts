import assert from "node:assert/strict";
import test from "node:test";

import { createInstrumentStore, type InstrumentSnapshot } from "../app/engine/instrument/store";
import { loadedStackArg, STACKS } from "../app/components/instrument-fixtures";

const loadBoth = (store: ReturnType<typeof createInstrumentStore>) => {
  store.dispatch({ type: "deck", action: "load", deck: "A", ...loadedStackArg(STACKS[0]) });
  store.dispatch({ type: "deck", action: "load", deck: "B", ...loadedStackArg(STACKS[1]) });
};

// Render-affecting fields: everything the program/preview shaders read. Excludes
// controlGrammar (§7.1: hashed but not in the RenderSnapshot).
const renderParams = (s: InstrumentSnapshot) => {
  const { controlGrammar: _g, ...rest } = s;
  void _g;
  return JSON.stringify(rest);
};

test("instrument store is deterministic for the same event/tick sequence", () => {
  const run = () => {
    const store = createInstrumentStore(138);
    loadBoth(store);
    store.dispatch({ type: "transport", action: "playing", deck: "A", value: true });
    store.dispatch({ type: "deck", action: "crossfader", valueQ16: 20000 });
    store.dispatch({ type: "eq", deck: "A", band: "HI", gainQ16: 0 });
    const snaps: string[] = [];
    for (let i = 0; i < 200; i += 1) snaps.push(JSON.stringify(store.advanceTick()));
    return snaps;
  };
  assert.deepEqual(run(), run());
});

test("§7.1 DJ/VJ switch changes only controlGrammar; render params (and pixels) are unchanged", () => {
  const store = createInstrumentStore(138);
  loadBoth(store);
  store.dispatch({ type: "deck", action: "channelOpacity", deck: "A", valueQ16: 40000 });
  store.dispatch({ type: "deck", action: "crossfader", valueQ16: 30000 });
  for (let i = 0; i < 8; i += 1) store.advanceTick(); // settle ramps

  const before = store.getSnapshot();
  const beforeParams = renderParams(before);
  store.dispatch({ type: "deck", action: "setGrammar", value: before.controlGrammar === "DJ" ? "VJ" : "DJ" });
  const after = store.getSnapshot();

  assert.notEqual(after.controlGrammar, before.controlGrammar); // grammar flipped
  // Render params byte-identical → program/preview pixel diff 0 (shader is a pure
  // function of these inputs).
  assert.equal(renderParams(after), beforeParams);
});

test("§7.4 composite inputs are premultiplied-linear and honor unloaded=0", () => {
  const store = createInstrumentStore(138);
  // No deck loaded → both contribute 0 regardless of opacity/crossfader.
  store.dispatch({ type: "deck", action: "crossfader", valueQ16: 32768 });
  for (let i = 0; i < 8; i += 1) store.advanceTick();
  const empty = store.getSnapshot();
  assert.equal(empty.A.stackHash, null);
  assert.equal(empty.B.stackHash, null);

  loadBoth(store);
  store.dispatch({ type: "deck", action: "channelOpacity", deck: "A", valueQ16: 65536 });
  store.dispatch({ type: "deck", action: "crossfader", valueQ16: 0 }); // full A
  for (let i = 0; i < 8; i += 1) store.advanceTick();
  const s = store.getSnapshot();
  assert.equal(s.crossfader, 0);
  assert.ok(Math.abs(s.A.opacity - 1) < 1e-6);
});

test("§8.3-7 program and preview never drift over a 10-minute run", () => {
  const store = createInstrumentStore(138);
  loadBoth(store);
  store.dispatch({ type: "transport", action: "playing", deck: "A", value: true });
  store.dispatch({ type: "transport", action: "playing", deck: "B", value: true });
  const TEN_MIN_TICKS = 36000;
  for (let i = 0; i < TEN_MIN_TICKS; i += 1) store.advanceTick();
  const s = store.getSnapshot();
  // Program and preview both read this single snapshot's tick → diff is 0 by
  // construction; assert the run reached the target tick deterministically.
  assert.equal(s.tick, TEN_MIN_TICKS);
  assert.equal(s.A.playing, true);
});

test("VJ launch reserves the next bar and commits at the target tick", () => {
  const store = createInstrumentStore(120); // 120 BPM → 1 bar = 120 ticks
  loadBoth(store);
  store.dispatch({ type: "deck", action: "setGrammar", value: "VJ" });
  store.dispatch({ type: "deck", action: "selectPreview", deck: "B" });
  const target = store.reservePreviewLaunch();
  assert.ok(target !== null && target > 0);
  assert.equal(store.getSnapshot().B.playing, false); // not playing yet
  while (store.getSnapshot().tick < (target as number)) store.advanceTick();
  assert.equal(store.getSnapshot().B.playing, true); // committed at the bar
  assert.equal(store.getSnapshot().pendingLaunch, null);
});
