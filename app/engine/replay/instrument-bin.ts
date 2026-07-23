// instrument.bin track — FISHVJ_INSTRUMENT_V1.md §5.5 (hard X-04 amendment).
//
// Lossless binary for continuous instrument events + frozen base param events,
// merged with the base control JSON by (sourceTick, orderInTick). One flush tick
// = one instrument sample: [deltaSourceTick u16, changedLaneMask u16,
// firstOrderInTick u8, value u16 per set bit]. Base param events share the chunk
// as 5B records. The instrument track header uses interval microseconds = 0 as
// the variable-interval sentinel. CRC / sequence / budget errors are failures.
import { concatBytes, crc32 } from "./binary";

// 13 lanes in fixed order (§5.5): EQ 6, channel opacity 2, tempo 2, crossfader 1, jog 2.
export const LANES = [
  "eqA_LOW", "eqA_MID", "eqA_HI", "eqB_LOW", "eqB_MID", "eqB_HI",
  "opacityA", "opacityB", "tempoA", "tempoB", "crossfader", "jogA", "jogB",
] as const;
export type Lane = (typeof LANES)[number];
export const JOG_LANES = new Set<Lane>(["jogA", "jogB"]);

export const INSTRUMENT_TRACK_ID = 3;
const HEADER_BYTES = 24;
const BASE_PARAM_BYTES = 5;
const VARIABLE_INTERVAL_SENTINEL = 0;

export type InstrumentSample = {
  deltaSourceTick: number;
  firstOrderInTick: number;
  /** lane index → value (raw14 as u16 for faders/EQ; jog as signed i16 0.25-frame sum). */
  lanes: Map<number, number>;
};

export type BaseParamRecord = {
  tickInChunk: number;
  orderInTick: number;
  dictionaryCode: number;
  canonicalValue: number;
};

function encodeSamples(samples: InstrumentSample[]): Uint8Array {
  const parts: number[] = [];
  const push16 = (v: number) => parts.push((v >>> 8) & 0xff, v & 0xff);
  for (const s of samples) {
    let mask = 0;
    for (const lane of s.lanes.keys()) mask |= 1 << lane;
    const laneCount = s.lanes.size;
    if (s.firstOrderInTick + laneCount - 1 > 255) {
      throw new RangeError("instrument sample orderInTick exceeds 255");
    }
    push16(s.deltaSourceTick);
    push16(mask);
    parts.push(s.firstOrderInTick & 0xff);
    for (let lane = 0; lane < LANES.length; lane += 1) {
      if (s.lanes.has(lane)) push16(s.lanes.get(lane)! & 0xffff);
    }
  }
  return Uint8Array.from(parts);
}

function encodeBaseParams(records: BaseParamRecord[]): Uint8Array {
  const out = new Uint8Array(records.length * BASE_PARAM_BYTES);
  const view = new DataView(out.buffer);
  records.forEach((r, i) => {
    const o = i * BASE_PARAM_BYTES;
    view.setUint8(o, r.tickInChunk);
    view.setUint8(o + 1, r.orderInTick);
    view.setUint8(o + 2, r.dictionaryCode);
    view.setUint16(o + 3, r.canonicalValue, false);
  });
  return out;
}

export function encodeInstrumentChunk(
  samples: InstrumentSample[],
  baseParams: BaseParamRecord[],
  startSourceT: number,
): Uint8Array {
  const payload = concatBytes([encodeSamples(samples), encodeBaseParams(baseParams)]);
  const out = new Uint8Array(HEADER_BYTES + payload.length);
  const view = new DataView(out.buffer);
  view.setUint8(0, INSTRUMENT_TRACK_ID);
  view.setUint8(1, 1);
  view.setUint16(2, samples.length, false); // sample count = instrument samples
  view.setFloat64(4, startSourceT, false);
  view.setUint32(12, VARIABLE_INTERVAL_SENTINEL, false);
  view.setUint32(16, payload.length, false);
  view.setUint32(20, crc32(payload), false);
  out.set(payload, HEADER_BYTES);
  return out;
}

export function decodeInstrumentChunk(bytes: Uint8Array): {
  samples: InstrumentSample[];
  baseParams: BaseParamRecord[];
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < HEADER_BYTES) throw new RangeError("instrument chunk truncated");
  const trackId = view.getUint8(0);
  if (trackId !== INSTRUMENT_TRACK_ID) throw new RangeError("not an instrument chunk");
  const sampleCount = view.getUint16(2, false);
  const payloadBytes = view.getUint32(16, false);
  const storedCrc = view.getUint32(20, false);
  if (HEADER_BYTES + payloadBytes > bytes.length) throw new RangeError("instrument chunk truncated payload");
  const payload = bytes.subarray(HEADER_BYTES, HEADER_BYTES + payloadBytes);
  if (crc32(payload) !== storedCrc) throw new RangeError("instrument chunk CRC mismatch");

  const samples: InstrumentSample[] = [];
  let o = 0;
  const read16 = () => {
    const v = (payload[o] << 8) | payload[o + 1];
    o += 2;
    return v;
  };
  for (let i = 0; i < sampleCount; i += 1) {
    const deltaSourceTick = read16();
    const mask = read16();
    const firstOrderInTick = payload[o];
    o += 1;
    const lanes = new Map<number, number>();
    for (let lane = 0; lane < LANES.length; lane += 1) {
      if (mask & (1 << lane)) lanes.set(lane, read16());
    }
    samples.push({ deltaSourceTick, firstOrderInTick, lanes });
  }

  const remaining = payloadBytes - o;
  if (remaining % BASE_PARAM_BYTES !== 0) {
    throw new RangeError("instrument chunk trailing bytes are not whole base-param records");
  }
  const baseParams: BaseParamRecord[] = [];
  for (let i = 0; i < remaining / BASE_PARAM_BYTES; i += 1) {
    const base = o + i * BASE_PARAM_BYTES;
    baseParams.push({
      tickInChunk: payload[base],
      orderInTick: payload[base + 1],
      dictionaryCode: payload[base + 2],
      canonicalValue: (payload[base + 3] << 8) | payload[base + 4],
    });
  }
  return { samples, baseParams };
}
