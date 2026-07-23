// Replay recorder — FISHVJ_DESIGN_V2.md §6.
//
// Observes the canonical (post-validation) EngineEvents and produces:
//   - control.json: dictionary-indexed tuples, source-tick recoverable, no
//     wall-clock `t` stored (§6.2)
//   - audio.bin: 15Hz band samples as CRC'd 1-second chunks (§6.3)
// The total archive is capped at 60,000 B/min and control at 28,000 B/min; an
// overrun throws (session invalid) rather than silently dropping (§6.4).
import { AUDIO_HZ, SIM_HZ, TICK_MS } from "../types";
import type { EngineEvent } from "../types";
import { AUDIO_SAMPLE_BYTES, AUDIO_TRACK_ID, concatBytes, encodeChunk } from "./binary";
import {
  BUDGET_CONTROL_PER_MIN,
  BUDGET_TOTAL_PER_MIN,
  COLORS,
  CONTROL_TYPES,
  MODES,
  PARAMS,
  PRODUCERS,
  SCALE_MILLI,
  SCALE_NORM,
  SCENES,
  SWARMS,
  SWIMS,
  sourceTickOf,
  TICKS_PER_MIN,
  type ReplayManifest,
} from "./format";

const q = (value: number, scale: number) => Math.round(value * scale);
const u8Band = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 255);
const AUDIO_INTERVAL_MICROS = Math.round(1e6 / AUDIO_HZ);
const AUDIO_SAMPLES_PER_CHUNK = AUDIO_HZ; // 1-second chunks

type RecordedArchive = {
  manifest: ReplayManifest;
  control: string;
  audioBin: Uint8Array;
  spaceBin: Uint8Array;
  bytes: { control: number; audio: number; space: number; total: number };
};

export class ReplayRecorder {
  private firstSourceT: number | null = null;
  private lastSourceTick = 0;
  private control: number[][] = [];
  private audioSamples: { sourceTick: number; bytes: [number, number, number, number] }[] = [];

  constructor(
    private readonly seed: number,
    private readonly deckId: string,
    private readonly deckHash: string,
    private readonly atlasHash = "sha256:unknown",
    private readonly engine = "fishvj-ref-v1",
  ) {}

  record(event: EngineEvent) {
    if (this.firstSourceT === null) this.firstSourceT = event.sourceT;
    const sourceTick = sourceTickOf(event.sourceT, this.firstSourceT);

    if (event.type === "beat" && event.payload.kind === "bands") {
      const [k, b, m, h] = event.payload.bands;
      this.audioSamples.push({
        sourceTick,
        bytes: [u8Band(k), u8Band(b), u8Band(m), u8Band(h)],
      });
      return;
    }

    const tuple = this.controlTuple(event, sourceTick);
    this.control.push(tuple);
    this.lastSourceTick = sourceTick;
  }

  private controlTuple(event: EngineEvent, sourceTick: number): number[] {
    const deltaSourceTick = sourceTick - this.lastSourceTick;
    const producerIndex = PRODUCERS.indexOf(event.producerId);
    const typeIndex = CONTROL_TYPES.indexOf(event.type as (typeof CONTROL_TYPES)[number]);
    const head = [deltaSourceTick, producerIndex, typeIndex];

    switch (event.type) {
      case "mode":
        return [...head, MODES.indexOf(event.payload.value)];
      case "scene":
        return [...head, SCENES.indexOf(event.payload.value)];
      case "macro":
        return [...head, COLORS.indexOf(event.payload.value)];
      case "oneshot":
        return [...head, 0];
      case "beat":
        // clock variant
        if (event.payload.kind !== "clock") throw new RangeError("unexpected beat kind");
        return [
          ...head,
          0,
          q(event.payload.bpm, SCALE_MILLI),
          q(event.payload.phase, SCALE_NORM),
          q(event.payload.confidence, SCALE_NORM),
          q(event.payload.flux, SCALE_NORM),
          q(event.payload.energy, SCALE_NORM),
        ];
      case "param":
        return this.paramTuple(head, event.payload);
      default:
        throw new RangeError(`replay recorder does not support event type ${event.type}`);
    }
  }

  private paramTuple(head: number[], payload: Extract<EngineEvent, { type: "param" }>["payload"]) {
    const code = PARAMS.indexOf(payload.id);
    switch (payload.id) {
      case "colorDrive":
        return [...head, code, q(payload.value, SCALE_NORM)];
      case "fishCount":
        return [...head, code, payload.value];
      case "fishSize":
      case "speed":
      case "depth":
        return [...head, code, q(payload.value, SCALE_MILLI)];
      case "dive":
      case "blackout":
        return [...head, code, payload.value ? 1 : 0];
      case "swimType":
        return [...head, code, SWIMS.indexOf(payload.value)];
      case "swarm":
        return [...head, code, SWARMS.indexOf(payload.value)];
      case "fishSelection":
        return [...head, code, payload.selectedSpecies, SWIMS.indexOf(payload.swimType)];
    }
  }

  private buildAudioBin(): Uint8Array {
    if (this.audioSamples.length === 0) return new Uint8Array(0);
    const chunks: Uint8Array[] = [];
    for (let start = 0; start < this.audioSamples.length; start += AUDIO_SAMPLES_PER_CHUNK) {
      const slice = this.audioSamples.slice(start, start + AUDIO_SAMPLES_PER_CHUNK);
      const payload = new Uint8Array(slice.length * AUDIO_SAMPLE_BYTES);
      slice.forEach((sample, i) => payload.set(sample.bytes, i * AUDIO_SAMPLE_BYTES));
      chunks.push(
        encodeChunk({
          trackId: AUDIO_TRACK_ID,
          version: 1,
          startSourceT: slice[0].sourceTick * TICK_MS,
          intervalMicros: AUDIO_INTERVAL_MICROS,
          payload,
        }),
      );
    }
    return concatBytes(chunks);
  }

  finalize(durationTicks: number): RecordedArchive {
    const audioBin = this.buildAudioBin();
    const spaceBin = new Uint8Array(0);
    const control = JSON.stringify(this.control);

    const manifest: ReplayManifest = {
      v: 1,
      engine: this.engine,
      deckId: this.deckId,
      deckHash: this.deckHash,
      atlasHash: this.atlasHash,
      seed: this.seed,
      simHz: SIM_HZ,
      audioHz: AUDIO_HZ,
      spaceHz: 5,
      firstSourceT: this.firstSourceT ?? 0,
      durationTicks,
      producers: [...PRODUCERS],
      types: [...CONTROL_TYPES],
      params: [...PARAMS],
    };

    const controlBytes = new TextEncoder().encode(control).length;
    const bytes = {
      control: controlBytes,
      audio: audioBin.length,
      space: spaceBin.length,
      total: controlBytes + audioBin.length + spaceBin.length,
    };

    // Budget is scaled to the recorded duration (§6.4 is stated per minute).
    const minutes = durationTicks / TICKS_PER_MIN;
    const controlCap = Math.ceil(BUDGET_CONTROL_PER_MIN * minutes);
    const totalCap = Math.ceil(BUDGET_TOTAL_PER_MIN * minutes);
    if (bytes.control > controlCap) {
      throw new RangeError(
        `replay control track ${bytes.control}B exceeds ${controlCap}B budget (session invalid)`,
      );
    }
    if (bytes.total > totalCap) {
      throw new RangeError(
        `replay archive ${bytes.total}B exceeds ${totalCap}B budget (session invalid)`,
      );
    }

    return { manifest, control, audioBin, spaceBin, bytes };
  }
}
