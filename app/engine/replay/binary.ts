// Replay binary chunk track — FISHVJ_DESIGN_V2.md §6.3.
//
// Fixed-interval sample streams (audio 4B/sample @15Hz, space 66B/sample @5Hz)
// are stored as 1-second chunks. Each chunk carries a 24-byte header and a
// CRC32 over its payload; a bad CRC or a truncated chunk fails the replay
// (§6.3 "欠損chunkはCRC/sequence errorとしてreplayを失敗させる").

const HEADER_BYTES = 24;

export const AUDIO_TRACK_ID = 1;
export const SPACE_TRACK_ID = 2;
export const AUDIO_SAMPLE_BYTES = 4; // kick,bass,mid,high u8
export const SPACE_SAMPLE_BYTES = 66; // grid[64] + energy + silRatio

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export type Chunk = {
  trackId: number;
  version: number;
  sampleCount: number;
  startSourceT: number;
  intervalMicros: number;
  payload: Uint8Array;
};

export function encodeChunk(chunk: Omit<Chunk, "sampleCount"> & { sampleCount?: number }): Uint8Array {
  const sampleBytes = chunk.trackId === SPACE_TRACK_ID ? SPACE_SAMPLE_BYTES : AUDIO_SAMPLE_BYTES;
  const sampleCount = chunk.payload.length / sampleBytes;
  if (!Number.isInteger(sampleCount)) throw new RangeError("payload is not a whole number of samples");

  const out = new Uint8Array(HEADER_BYTES + chunk.payload.length);
  const view = new DataView(out.buffer);
  view.setUint8(0, chunk.trackId);
  view.setUint8(1, chunk.version);
  view.setUint16(2, sampleCount, false);
  view.setFloat64(4, chunk.startSourceT, false);
  view.setUint32(12, chunk.intervalMicros, false);
  view.setUint32(16, chunk.payload.length, false);
  view.setUint32(20, crc32(chunk.payload), false);
  out.set(chunk.payload, HEADER_BYTES);
  return out;
}

export function decodeChunks(bytes: Uint8Array): Chunk[] {
  const chunks: Chunk[] = [];
  let offset = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (offset < bytes.length) {
    if (offset + HEADER_BYTES > bytes.length) {
      throw new RangeError("replay binary track truncated in chunk header");
    }
    const trackId = view.getUint8(offset);
    const version = view.getUint8(offset + 1);
    const sampleCount = view.getUint16(offset + 2, false);
    const startSourceT = view.getFloat64(offset + 4, false);
    const intervalMicros = view.getUint32(offset + 12, false);
    const payloadBytes = view.getUint32(offset + 16, false);
    const storedCrc = view.getUint32(offset + 20, false);
    const payloadStart = offset + HEADER_BYTES;
    if (payloadStart + payloadBytes > bytes.length) {
      throw new RangeError("replay binary track truncated in chunk payload");
    }
    const payload = bytes.subarray(payloadStart, payloadStart + payloadBytes);
    if (crc32(payload) !== storedCrc) {
      throw new RangeError(`replay binary chunk CRC mismatch at offset ${offset}`);
    }
    const sampleBytes = trackId === SPACE_TRACK_ID ? SPACE_SAMPLE_BYTES : AUDIO_SAMPLE_BYTES;
    if (payloadBytes !== sampleCount * sampleBytes) {
      throw new RangeError("replay binary chunk sample count does not match payload");
    }
    chunks.push({ trackId, version, sampleCount, startSourceT, intervalMicros, payload });
    offset = payloadStart + payloadBytes;
  }
  return chunks;
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
