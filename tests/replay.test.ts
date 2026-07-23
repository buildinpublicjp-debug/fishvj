import assert from "node:assert/strict";
import test from "node:test";

import { deck } from "../app/engine/deck";
import { decodeChunks } from "../app/engine/replay/binary";
import { driveSession, parseArchive } from "../app/engine/replay/playback";
import { ReplayRecorder } from "../app/engine/replay/record";
import { createEngineStore } from "../app/engine/store";
import { AUDIO_TICK_INTERVAL } from "../app/engine/types";
import type { EngineEventInput } from "../app/engine/types";

const HASH_CONTEXT = { deckContentHash: deck.contentHash, width: 1920, height: 1080 };
const DURATION_TICKS = 3600; // 60s at 60Hz

// A deterministic band value in the 8-bit resolution the audio track stores.
const band = (tick: number, channel: number) =>
  Math.round((0.5 + 0.5 * Math.sin(tick * 0.017 + channel * 1.3)) * 255) / 255;

// Builds a scripted 60s session: audio bands every 4 ticks plus a spread of
// control events across every axis (mode/scene/macro/swarm/params/selection/
// dive/blackout/reset/beat-clock).
function buildSession(): Map<number, EngineEventInput[]> {
  const events = new Map<number, EngineEventInput[]>();
  const add = (tick: number, input: EngineEventInput) => {
    const list = events.get(tick);
    if (list) list.push(input);
    else events.set(tick, [input]);
  };

  for (let tick = 0; tick <= DURATION_TICKS; tick += AUDIO_TICK_INTERVAL) {
    add(tick, {
      v: 1,
      producerId: "audio",
      type: "beat",
      payload: {
        kind: "bands",
        bands: [band(tick, 0), band(tick, 1), band(tick, 2), band(tick, 3)],
      },
    });
  }

  const ui = (type: EngineEventInput["type"], payload: unknown) =>
    ({ v: 1, producerId: "ui", type, payload }) as EngineEventInput;

  add(120, ui("mode", { update: "absolute", value: "SENSUAL" }));
  add(300, ui("macro", { update: "absolute", value: "ACID" }));
  add(480, ui("param", { id: "swarm", update: "absolute", value: "BLOOM" }));
  add(600, ui("param", { id: "colorDrive", update: "absolute", value: 0.4137 }));
  add(720, ui("param", { id: "fishCount", update: "absolute", value: 1450 }));
  add(900, ui("param", { id: "fishSize", update: "absolute", value: 2.35 }));
  add(1080, ui("param", { id: "speed", update: "absolute", value: 1.12 }));
  add(1260, ui("param", { id: "depth", update: "absolute", value: 0.63 }));
  add(1440, ui("scene", { update: "absolute", value: "FREE_SWIM" }));
  add(1620, ui("param", { id: "fishSelection", update: "atomic", selectedSpecies: 5, swimType: "WAVE" }));
  add(1800, ui("param", { id: "dive", update: "absolute", value: true }));
  add(2100, ui("param", { id: "dive", update: "absolute", value: false }));
  add(2400, ui("mode", { update: "absolute", value: "EUPHORIC" }));
  add(2460, {
    v: 1,
    producerId: "audio",
    type: "beat",
    payload: { kind: "clock", bpm: 138.5, phase: 0.25, confidence: 0.8, flux: 0.4, energy: 0.6 },
  });
  add(2700, ui("param", { id: "blackout", update: "absolute", value: true }));
  add(2760, ui("param", { id: "blackout", update: "absolute", value: false }));
  add(3000, ui("param", { id: "swarm", update: "absolute", value: "VORTEX" }));
  add(3300, ui("oneshot", { id: "reset", update: "trigger" }));
  return events;
}

test("a 60s session records and replays to an identical hash trace", () => {
  const session = buildSession();

  const recorder = new ReplayRecorder(
    createEngineStore().getState().seed,
    deck.id,
    deck.contentHash,
  );
  const recordStore = createEngineStore();
  const recordTrace = driveSession(recordStore, session, DURATION_TICKS, HASH_CONTEXT, (event) =>
    recorder.record(event),
  );
  const archive = recorder.finalize(DURATION_TICKS);

  const replaySchedule = parseArchive(archive);
  const replayStore = createEngineStore();
  const replayTrace = driveSession(replayStore, replaySchedule, DURATION_TICKS, HASH_CONTEXT);

  assert.equal(replayTrace.length, recordTrace.length);
  assert.deepEqual(replayTrace, recordTrace);
  // 30-tick trace over 0..3600 inclusive.
  assert.equal(recordTrace.length, DURATION_TICKS / 30 + 1);
});

test("a 60s archive fits the byte budget and reports its size", () => {
  const session = buildSession();
  const recorder = new ReplayRecorder(0x46495348, deck.id, deck.contentHash);
  driveSession(createEngineStore(), session, DURATION_TICKS, HASH_CONTEXT, (e) => recorder.record(e));
  const archive = recorder.finalize(DURATION_TICKS);

  // ≤ 60,000 B/min total, ≤ 28,000 B/min control (§6.4).
  assert.ok(archive.bytes.total <= 60000, `total ${archive.bytes.total}B`);
  assert.ok(archive.bytes.control <= 28000, `control ${archive.bytes.control}B`);
  // Audio: 4B × 15Hz × 60s = 3600B of payload before chunk headers.
  assert.ok(archive.bytes.audio >= 3600);
});

test("replay fails on a corrupted audio chunk (CRC)", () => {
  const session = buildSession();
  const recorder = new ReplayRecorder(0x46495348, deck.id, deck.contentHash);
  driveSession(createEngineStore(), session, DURATION_TICKS, HASH_CONTEXT, (e) => recorder.record(e));
  const archive = recorder.finalize(DURATION_TICKS);

  const corrupted = Uint8Array.from(archive.audioBin);
  corrupted[corrupted.length - 1] ^= 0xff; // flip a payload byte
  assert.throws(() => decodeChunks(corrupted), /CRC mismatch/);

  const truncated = archive.audioBin.subarray(0, archive.audioBin.length - 3);
  assert.throws(() => decodeChunks(truncated), /truncated/);
});

test("the recorder invalidates a session that busts the control budget", () => {
  const recorder = new ReplayRecorder(0x46495348, deck.id, deck.contentHash);
  const store = createEngineStore();
  // Many control events in a 1-second window (control cap ≈ 467B) → over budget.
  const dense = new Map<number, EngineEventInput[]>();
  for (let tick = 0; tick <= 60; tick += 1) {
    dense.set(tick, [
      { v: 1, producerId: "ui", type: "param", payload: { id: "fishCount", update: "absolute", value: 100 + tick } },
    ]);
  }
  driveSession(store, dense, 60, HASH_CONTEXT, (e) => recorder.record(e));
  assert.throws(() => recorder.finalize(60), /exceeds .* budget \(session invalid\)/);
});
