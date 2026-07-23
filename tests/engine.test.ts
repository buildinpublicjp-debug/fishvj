import assert from "node:assert/strict";
import test from "node:test";

import { FixedStepClock } from "../app/engine/clock";
import { ParamEventCoalescer } from "../app/engine/coalesce";
import { deck, loadDeck } from "../app/engine/deck";
import { createSeededRandom } from "../app/engine/prng";
import { createEngineStore } from "../app/engine/store";
import { sha256Hex } from "../app/engine/sha256";
import type { EngineEventInput } from "../app/engine/types";

test("the frozen FishVJ seed produces a stable mulberry32 stream", () => {
  const random = createSeededRandom();
  assert.deepEqual(
    Array.from({ length: 5 }, () => random()),
    [
      0.7484242380596697,
      0.17063292604871094,
      0.7219872972927988,
      0.24117815308272839,
      0.4777104198001325,
    ],
  );
});

test("fixed-step clock caps catch-up without dropping pending ticks", () => {
  const clock = new FixedStepClock();
  clock.accumulate(1000);
  clock.accumulate(1200);
  assert.equal(clock.takeTicks(5), 5);
  assert.equal(clock.pendingTicks, 7);
  assert.equal(clock.takeTicks(5), 5);
  assert.equal(clock.pendingTicks, 2);
  assert.equal(clock.takeTicks(5), 2);
  assert.equal(clock.pendingTicks, 0);
});

test("continuous params are coalesced before the canonical bus at 8Hz", async () => {
  let now = 0;
  const emitted: Array<{ value: number; sourceT: number }> = [];
  const coalescer = new ParamEventCoalescer(
    (payload, sourceT) => {
      if (payload.id === "speed") emitted.push({ value: payload.value, sourceT });
    },
    { now: () => now },
  );

  coalescer.push({ id: "speed", update: "absolute", value: 0.4 }, 0);
  now = 10;
  coalescer.push({ id: "speed", update: "absolute", value: 0.5 }, 10);
  now = 20;
  coalescer.push({ id: "speed", update: "absolute", value: 0.6 }, 20);
  now = 125;
  await new Promise((resolve) => setTimeout(resolve, 135));
  coalescer.dispose();

  assert.deepEqual(emitted, [
    { value: 0.4, sourceT: 0 },
    { value: 0.6, sourceT: 20 },
  ]);
});

test("bus owns arrival time and sequence while preserving producer sourceT", () => {
  let now = 100;
  const store = createEngineStore({ now: () => now });
  const first = store.dispatch({
    v: 1,
    producerId: "ui",
    sourceT: 40,
    type: "mode",
    payload: { update: "absolute", value: "SENSUAL" },
  });
  now = 130;
  const second = store.dispatch({
    v: 1,
    producerId: "keys",
    type: "scene",
    payload: { update: "absolute", value: "FREE_SWIM" },
  });

  assert.deepEqual(
    [first.t, first.sourceT, first.seq, second.t, second.sourceT, second.seq],
    [100, 40, 0, 130, 130, 1],
  );
});

test("fish card selection and reset are each one atomic reducer event", () => {
  const store = createEngineStore({ now: () => 10 });
  store.dispatch({
    v: 1,
    producerId: "ui",
    type: "param",
    payload: {
      id: "fishSelection",
      update: "atomic",
      selectedSpecies: 5,
      swimType: "WAVE",
    },
  });
  assert.equal(store.getState().selectedSpecies, 5);
  assert.equal(store.getState().swimType, "WAVE");
  store.advanceTick();
  const tickBeforeReset = store.getState().tick;

  store.dispatch({
    v: 1,
    producerId: "ui",
    type: "oneshot",
    payload: { id: "reset", update: "trigger" },
  });
  assert.equal(store.getState().selectedSpecies, 0);
  assert.equal(store.getState().swimType, "SCHOOL");
  assert.equal(store.getState().tick, tickBeforeReset);
});

test("identical event and tick sequences produce identical transition snapshots", () => {
  const run = () => {
    const store = createEngineStore({ now: () => 0 });
    store.dispatch({
      v: 1,
      producerId: "ui",
      type: "scene",
      payload: { update: "absolute", value: "FREE_SWIM" },
    });
    store.dispatch({
      v: 1,
      producerId: "ui",
      type: "param",
      payload: { id: "swarm", update: "absolute", value: "BLOOM" },
    });
    store.dispatch({
      v: 1,
      producerId: "ui",
      type: "param",
      payload: { id: "dive", update: "absolute", value: true },
    });
    for (let tick = 0; tick < 45; tick += 1) store.advanceTick();
    return { state: store.getState(), snapshot: store.getRenderSnapshot({ width: 1920, height: 1080 }) };
  };

  assert.deepEqual(run(), run());
  const { state, snapshot } = run();
  assert.equal(state.tick, 45);
  assert.equal(state.swarmMix, 0.5);
  assert.equal(snapshot.uTime, 0.75);
  assert.equal(snapshot.uAspect, 16 / 9);
});

test("an idle swarm remains fully settled across simulation ticks", () => {
  const store = createEngineStore({ now: () => 0 });
  for (let tick = 0; tick < 120; tick += 1) store.advanceTick();
  assert.equal(store.getState().swarmMix, 1);
  assert.equal(store.getRenderSnapshot().uSwarmMix, 1);
});

test("S1 rejects disabled producers and out-of-range params before reduction", () => {
  const store = createEngineStore({ now: () => 0 });
  assert.throws(
    () =>
      store.dispatch({
        v: 1,
        producerId: "midi",
        type: "mode",
        payload: { update: "absolute", value: "MYSTIC" },
      }),
    /not enabled/,
  );
  assert.throws(
    () =>
      store.dispatch({
        v: 1,
        producerId: "ui",
        type: "param",
        payload: { id: "fishCount", update: "absolute", value: 2001 },
      }),
    /fishCount/,
  );
  assert.throws(
    () =>
      store.dispatch({
        v: 1,
        producerId: "ui",
        type: "unknown",
        payload: {},
      } as unknown as EngineEventInput),
    /unknown EngineEvent type/,
  );
});

test("deck v0 externalizes exactly the pre-deck scale and motion literals", () => {
  // The values FishCanvas used inline before deck v0, unchanged.
  assert.deepEqual(deck.speciesScales, [0.72, 1.1, 0.92, 1.14, 0.82, 1.2, 0.9, 0.8]);
  assert.deepEqual(deck.speciesMotions, [0, 1, 3, 1, 3, 2, 3, 0]);
  assert.equal(deck.id, "gyogen-v0");
  assert.match(deck.contentHash, /^sha256:[0-9a-f]{64}$/);
});

test("deck v0 validation rejects reorder, wrong length and bad motion", () => {
  const base = {
    v: 0,
    id: "test",
    name: "t",
    species: Array.from({ length: 8 }, (_, index) => ({
      index,
      scale: 1,
      motion: "SCHOOL" as const,
    })),
  };
  assert.doesNotThrow(() => loadDeck(base));
  assert.throws(() => loadDeck({ ...base, v: 1 }), /schema version must be 0/);
  assert.throws(() => loadDeck({ ...base, species: base.species.slice(0, 7) }), /length 8/);
  const reordered = base.species.map((s, i) => ({ ...s, index: (i + 1) % 8 }));
  assert.throws(() => loadDeck({ ...base, species: reordered }), /ascending, fixed/);
  const badMotion = base.species.map((s) => ({ ...s, motion: "DRIFT" }));
  assert.throws(() => loadDeck({ ...base, species: badMotion }), /motion is invalid/);
});

test("sha256Hex matches the well-known abc digest", () => {
  assert.equal(
    sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
