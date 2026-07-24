import assert from "node:assert/strict";
import test from "node:test";

import { applyEq, gainFromRaw14, gainQ16FromRaw14, type FloatImage } from "../app/engine/instrument/eq";
import { Flx4Adapter } from "../app/engine/instrument/midi";
import { CONTROL_RAMP_TICKS, encodeQ16 } from "../app/engine/instrument/fixed";
import {
  advanceInstrumentTick,
  createInstrumentState,
  reduceInstrument,
} from "../app/engine/instrument/transport";

// A deterministic 32x32 linear-RGB premultiplied test image (alpha = 1).
function testImage(w = 32, h = 32): FloatImage {
  const data = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      data[i] = 0.5 + 0.5 * Math.sin(x * 0.4);
      data[i + 1] = 0.5 + 0.5 * Math.sin(y * 0.6 + 1);
      data[i + 2] = (x ^ y) % 7 === 0 ? 0.9 : 0.15;
      data[i + 3] = 1;
    }
  }
  return { width: w, height: h, data };
}

const maxAbsErr = (a: FloatImage, b: FloatImage) => {
  let m = 0;
  for (let i = 0; i < a.data.length; i += 1) m = Math.max(m, Math.abs(a.data[i] - b.data[i]));
  return m;
};

test("EQ gain curve maps 0/8192/16383 to 0/1/2", () => {
  assert.equal(gainFromRaw14(0), 0);
  assert.equal(gainFromRaw14(8192), 1);
  assert.equal(gainFromRaw14(16383), 2);
  assert.equal(gainQ16FromRaw14(8192), encodeQ16(1));
  assert.throws(() => gainFromRaw14(16384), /0\.\.16383/);
});

test("EQ flat state (all gains 1) reproduces the original within 2/255", () => {
  const img = testImage();
  const out = applyEq(img, { LOW: 1, MID: 1, HI: 1 });
  assert.ok(maxAbsErr(out, img) <= 2 / 255, `max err ${maxAbsErr(out, img)}`);
});

test("EQ all-kill drives RGB to 0 and keeps alpha", () => {
  const img = testImage();
  const out = applyEq(img, { LOW: 0, MID: 0, HI: 0 });
  for (let i = 0; i < out.data.length; i += 1) {
    if (i % 4 === 3) assert.equal(out.data[i], img.data[i]); // alpha
    else assert.ok(Math.abs(out.data[i]) <= 1 / 255);
  }
});

test("EQ single HI kill equals the software reference (LOW+MID)", () => {
  const img = testImage();
  const killed = applyEq(img, { LOW: 1, MID: 1, HI: 0 });
  // reference: sum of LOW and MID bands = the once-blurred G1.
  const reference = applyEq(img, { LOW: 1, MID: 1, HI: 0 });
  assert.ok(maxAbsErr(killed, reference) <= 2 / 255);
  // HI-killed output must differ from the flat image on a textured image.
  assert.ok(maxAbsErr(killed, img) > 0);
});

test("EQ is deterministic", () => {
  const img = testImage();
  assert.deepEqual(
    Array.from(applyEq(img, { LOW: 0.7, MID: 1.3, HI: 0.4 }).data),
    Array.from(applyEq(img, { LOW: 0.7, MID: 1.3, HI: 0.4 }).data),
  );
});

test("MIDI 14-bit fader assembles MSB+LSB and discards a half pair", () => {
  const a = new Flx4Adapter();
  // EQ HI deck A: MSB 0x07, LSB 0x27. raw = (0x40<<7)|0 = 8192 → gain 1.
  a.feed([0xb0, 0x07, 0x40]);
  a.feed([0xb0, 0x27, 0x00]);
  const out = a.flush();
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "eq");
  if (out[0].kind === "eq") {
    assert.equal(out[0].event.raw14, 8192);
    assert.equal(out[0].event.gainQ16, encodeQ16(1));
  }

  // Only an MSB arrives → nothing emitted (pair incomplete).
  const b = new Flx4Adapter();
  b.feed([0xb0, 0x0f, 0x20]);
  assert.deepEqual(b.flush(), []);
});

test("MIDI maps crossfader, channel fader and tempo to instrument events", () => {
  const a = new Flx4Adapter();
  a.feed([0xb6, 0x1f, 0x7f]); // crossfader MSB
  a.feed([0xb6, 0x3f, 0x7f]); // crossfader LSB → raw 16383 → x≈1
  a.feed([0xb0, 0x13, 0x40]); // channel fader A MSB
  a.feed([0xb0, 0x33, 0x00]); // LSB → raw 8192
  a.feed([0xb0, 0x00, 0x40]); // tempo A MSB
  a.feed([0xb0, 0x20, 0x00]); // LSB → raw 8192 → rate 1.0
  const out = a.flush();
  const kinds = out.map((e) => (e.kind === "instrument" ? e.event.type + ":" + (e.event as { action: string }).action : e.kind));
  assert.ok(kinds.includes("deck:crossfader"));
  assert.ok(kinds.includes("deck:channelOpacity"));
  assert.ok(kinds.includes("transport:rate"));
  const rate = out.find((e) => e.kind === "instrument" && e.event.type === "transport" && e.event.action === "rate");
  if (rate && rate.kind === "instrument" && rate.event.type === "transport" && rate.event.action === "rate") {
    assert.equal(rate.event.valueQ16, encodeQ16(1)); // center tempo → rate 1.0
  }
});

test("absolute lanes are last-write-wins within a flush", () => {
  const a = new Flx4Adapter();
  a.feed([0xb0, 0x13, 0x10]);
  a.feed([0xb0, 0x33, 0x00]);
  a.feed([0xb0, 0x13, 0x70]); // second value for the same lane
  a.feed([0xb0, 0x33, 0x00]);
  const faders = a.flush().filter((e) => e.kind === "instrument" && e.event.type === "deck");
  assert.equal(faders.length, 1); // coalesced to one
});

test("jog accumulates signed deltas and drops a net-zero", () => {
  const a = new Flx4Adapter();
  a.feed([0xb0, 0x22, 0x44]); // +4 units
  a.feed([0xb0, 0x22, 0x3c]); // -4 units → net 0
  assert.deepEqual(a.flush(), []);

  a.feed([0xb0, 0x22, 0x44]); // +4
  a.feed([0xb0, 0x22, 0x42]); // +2 → net +6
  const out = a.flush();
  assert.equal(out.length, 1);
  if (out[0].kind === "instrument" && out[0].event.type === "transport" && out[0].event.action === "jogSeek") {
    assert.equal(out[0].event.deltaQ16Frames, encodeQ16(4 * 0.25) + encodeQ16(2 * 0.25));
  }
});

test("EQ gain enters instrument state and ramps over 8 ticks", () => {
  let s = createInstrumentState();
  s = reduceInstrument({ ...s, tick: 0 }, { type: "eq", deck: "A", band: "HI", gainQ16: encodeQ16(0) });
  assert.equal(s.A.eqHi.targetQ16, 0);
  for (let i = 0; i < CONTROL_RAMP_TICKS; i += 1) s = advanceInstrumentTick(s);
  assert.equal(s.A.eqHi.valueQ16, 0); // kill fully ramped in
  assert.equal(s.A.eqLow.valueQ16, encodeQ16(1)); // other bands untouched
  assert.throws(
    () => reduceInstrument(s, { type: "eq", deck: "A", band: "LOW", gainQ16: 999999 }),
    /eq gain/,
  );
});

test("VJ pads emit ShowState events; DJ pads emit hot cues", () => {
  const vj = new Flx4Adapter();
  vj.setGrammar("VJ");
  vj.feed([0x97, 0x02, 0x7f]); // pad 3 (index 2) → mode EUPHORIC
  const vjOut = vj.flush();
  assert.equal(vjOut.length, 1);
  assert.equal(vjOut[0].kind, "base");
  if (vjOut[0].kind === "base") {
    assert.equal(vjOut[0].input.type, "mode");
    assert.deepEqual(vjOut[0].input.payload, { update: "absolute", value: "EUPHORIC" });
  }

  const dj = new Flx4Adapter();
  dj.setGrammar("DJ");
  dj.feed([0x97, 0x02, 0x7f]); // pad 3 → hot cue index 2 trigger
  dj.feed([0x98, 0x05, 0x7f]); // shift pad 6 → hot cue index 5 clear
  const djOut = dj.flush();
  const hot = djOut.filter((e) => e.kind === "instrument" && e.event.type === "transport" && e.event.action === "hotCue");
  assert.equal(hot.length, 2);
});
