import assert from "node:assert/strict";
import test from "node:test";

import {
  adoptAnchor,
  beatQ16At,
  canonicalizeClock,
  firstAnchor,
  reserveLaunch,
} from "../app/engine/instrument/launch";
import { GeneratedOrder, resolveOrders } from "../app/engine/instrument/source";
import { stackContentHash, type StackManifestV0 } from "../app/engine/instrument/stack";

function fixtureStack(overrides: Partial<StackManifestV0["prep"]["provenance"]> = {}): StackManifestV0 {
  const count = 60;
  const s: StackManifestV0 = {
    v: 0,
    id: "gen-stack",
    name: "generated",
    sourceKind: "generated",
    contentHash: "sha256:pending",
    frame: {
      width: 960, height: 540, fps: 30, count, maxPayloadBytes: 62208000,
      accessKind: "independent-frames", assetPath: "g/frames.bin", assetHash: "sha256:1", byteLength: count * 960 * 540,
    },
    depth: { width: 960, height: 540, format: "r8-unorm", assetPath: "g/depth.bin", assetHash: "sha256:2", byteLength: 518400 },
    alpha: { width: 960, height: 540, format: "r8-unorm", assetPath: "g/alpha.bin", assetHash: "sha256:3", byteLength: 518400 },
    prep: {
      simHz: 60, frameStepTicks: 2, durationTicks: count * 2, phaseAxis: "beat",
      loop: { startTick: 0, endTickExclusive: count * 2, mode: "wrap" },
      parallax: { enabled: false, maxDisplacementPx: 0, edgeDilatePx: 0 },
      provenance: { licenseStatus: "cleared", ...overrides },
    },
    access: { gopFrames: 1, cacheFrames: 30, reverseFrames: 15, decodeP95Ms: "unverified", memoryCeilingBytes: 134217728 },
  };
  s.contentHash = stackContentHash(s);
  return s;
}

test("clock canonicalization is stable and integer", () => {
  const c = canonicalizeClock(138, 0.25, 0.8);
  assert.equal(c.bpmQ16, Math.floor(138 * 65536 + 0.5));
  assert.ok(c.phaseQ16 >= 0 && c.phaseQ16 <= 65535);
  assert.equal(c.confidenceU16, Math.floor(0.8 * 65535 + 0.5));
  // phase < 1.0 never rounds up to 65536.
  assert.ok(canonicalizeClock(120, 0.999999, 1).phaseQ16 <= 65535);
});

test("bar launch snaps to the next 4-beat boundary and is deterministic", () => {
  const clock = canonicalizeClock(120, 0, 1); // 120 BPM, phase 0, confident
  const anchor = firstAnchor(0, clock);
  // At 120 BPM, one beat = 60*SIM_HZ/bpmQ16 ticks = 3600/120 = 30 ticks; a bar = 120 ticks.
  const r1 = reserveLaunch(anchor, 10, clock.confidenceU16);
  assert.equal(r1.targetTick, 120); // first bar boundary after tick 10
  const r2 = reserveLaunch(anchor, 130, clock.confidenceU16);
  assert.equal(r2.targetTick, 240); // next bar after 130
  // determinism
  assert.deepEqual(reserveLaunch(anchor, 10, clock.confidenceU16), r1);
});

test("low confidence launches on the next tick instead of a bar", () => {
  const clock = canonicalizeClock(120, 0, 0.4); // confidence < 0.5
  const anchor = firstAnchor(0, clock);
  const r = reserveLaunch(anchor, 55, clock.confidenceU16);
  assert.equal(r.targetTick, 56);
});

test("a later anchor stays phase-locked near the predicted beat position", () => {
  const clock = canonicalizeClock(120, 0, 1);
  const a0 = firstAnchor(0, clock);
  const predicted = beatQ16At(a0, 90); // 3 beats in
  const a1 = adoptAnchor(a0, 90, canonicalizeClock(120, 0, 1));
  // The re-adopted beat position is within half a beat of the prediction.
  const diff = a1.beatAQ16 - predicted;
  assert.ok(diff <= BigInt(32768) && diff >= BigInt(-32768));
});

test("generated order reaches ready only after prep + validation pass", () => {
  const good = new GeneratedOrder("job-1", () => fixtureStack());
  assert.equal(good.state, "preparing");
  good.resolve();
  assert.equal(good.state, "ready");
  assert.ok(good.cleared());

  const bad = new GeneratedOrder("job-2", () => ({ error: "provider timeout" }));
  bad.resolve();
  assert.equal(bad.state, "failed");
});

test("unverified license loads technically but is not cleared for projection", () => {
  const order = new GeneratedOrder("job-3", () => fixtureStack({ licenseStatus: "unverified" }));
  order.resolve();
  assert.equal(order.state, "ready"); // technical load allowed
  assert.equal(order.cleared(), false); // but not cleared
});

test("a failed source isolates and does not block the others", () => {
  const orders = [
    new GeneratedOrder("ok-1", () => fixtureStack()),
    new GeneratedOrder("fail", () => ({ error: "nsfw filter" })),
    new GeneratedOrder("ok-2", () => fixtureStack({ author: "x" })),
  ];
  const { ready, failed } = resolveOrders(orders);
  assert.equal(ready.length, 2);
  assert.equal(failed.length, 1);
  assert.equal(failed[0].providerJobId, "fail");
});

test("reservation is only available once ready", () => {
  const clock = canonicalizeClock(120, 0, 1);
  const anchor = firstAnchor(0, clock);
  const order = new GeneratedOrder("job", () => fixtureStack());
  assert.equal(order.reserve(anchor, 10, clock.confidenceU16), null); // not ready yet
  order.resolve();
  const r = order.reserve(anchor, 10, clock.confidenceU16);
  assert.ok(r && r.targetTick === 120);
});

import {
  decodeInstrumentChunk,
  encodeInstrumentChunk,
  LANES,
  type BaseParamRecord,
  type InstrumentSample,
} from "../app/engine/replay/instrument-bin";
import { crc32 } from "../app/engine/replay/binary";

test("instrument.bin round-trips instrument samples and base-param records", () => {
  const samples: InstrumentSample[] = [
    { deltaSourceTick: 0, firstOrderInTick: 0, lanes: new Map([[0, 8192], [10, 16383]]) }, // eqA_LOW + crossfader
    { deltaSourceTick: 8, firstOrderInTick: 3, lanes: new Map([[6, 40000], [11, 0xffff]]) }, // opacityA + jogA (i16)
  ];
  const baseParams: BaseParamRecord[] = [
    { tickInChunk: 0, orderInTick: 2, dictionaryCode: 1, canonicalValue: 800 },
    { tickInChunk: 8, orderInTick: 4, dictionaryCode: 5, canonicalValue: 65535 },
  ];
  const chunk = encodeInstrumentChunk(samples, baseParams, 0);
  const decoded = decodeInstrumentChunk(chunk);

  assert.equal(decoded.samples.length, 2);
  assert.deepEqual([...decoded.samples[0].lanes.entries()], [[0, 8192], [10, 16383]]);
  assert.deepEqual([...decoded.samples[1].lanes.entries()], [[6, 40000], [11, 0xffff]]);
  assert.deepEqual(decoded.baseParams, baseParams);
  assert.equal(LANES.length, 13);
});

test("instrument.bin rejects a corrupted chunk", () => {
  const chunk = encodeInstrumentChunk(
    [{ deltaSourceTick: 0, firstOrderInTick: 0, lanes: new Map([[2, 12000]]) }],
    [],
    0,
  );
  const corrupted = Uint8Array.from(chunk);
  corrupted[corrupted.length - 1] ^= 0xff;
  assert.throws(() => decodeInstrumentChunk(corrupted), /CRC mismatch/);
  void crc32; // exercised via encode/decode
});

test("instrument.bin rejects an over-255 order run", () => {
  assert.throws(
    () =>
      encodeInstrumentChunk(
        [{ deltaSourceTick: 0, firstOrderInTick: 254, lanes: new Map([[0, 1], [1, 2], [2, 3]]) }],
        [],
        0,
      ),
    /orderInTick exceeds 255/,
  );
});
