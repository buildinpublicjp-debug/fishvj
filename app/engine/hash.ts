// Canonical semantic-state hash — FISHVJ_DESIGN_V2.md §5.
//
// This is the full §5.2 field set that exists as of S2 (S1 visual + transition
// state, plus the T0-B beat/audio state). Space state (§5.2 "Space semantic
// state") arrives in S3 and is absent here. Encoding follows §5.3: enums as
// fixed-table u8, booleans as u8, normalized floats as round(v * 65535), other
// floats by an explicit per-field scale, ticks/counts as u32, a fixed field
// order, hashed with 64-bit FNV-1a. A trace samples every 30 simulation ticks.
import type { EngineState, RenderSnapshot } from "./types";

const SCENES = ["MANDALA", "FREE_SWIM"];
const MODES = ["MYSTIC", "SENSUAL", "EUPHORIC"];
const COLORS = ["CLEAN", "PUNCH", "ACID", "DEEP"];
const SWIMS = ["SCHOOL", "GLIDE", "WAVE", "FLOAT"];
const SWARMS = ["SPIRAL", "VORTEX", "WAVE", "BLOOM"];

const FNV_OFFSET = BigInt("0xcbf29ce484222325");
const FNV_PRIME = BigInt("0x100000001b3");
const MASK = BigInt("0xffffffffffffffff");

export const HASH_TICK_INTERVAL = 30;

class Writer {
  bytes: number[] = [];

  u8(value: number) {
    this.bytes.push(value & 0xff);
    return this;
  }

  u32(value: number) {
    const v = value >>> 0;
    this.bytes.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
    return this;
  }

  norm(value: number) {
    return this.u32(Math.round(Math.min(1, Math.max(0, value)) * 65535));
  }

  scaled(value: number, scale: number) {
    return this.u32(Math.round(value * scale));
  }

  bool(value: boolean) {
    return this.u8(value ? 1 : 0);
  }

  enumValue(table: string[], value: string) {
    const index = table.indexOf(value);
    if (index < 0) throw new RangeError(`unknown enum value ${value}`);
    return this.u8(index);
  }

  ascii(value: string) {
    for (let i = 0; i < value.length; i += 1) this.u8(value.charCodeAt(i) & 0xff);
    return this.u32(value.length);
  }
}

export type HashContext = {
  deckContentHash: string;
  width: number;
  height: number;
};

export function encodeState(
  state: EngineState,
  snapshot: RenderSnapshot,
  context: HashContext,
): Uint8Array {
  const w = new Writer();

  // Session / clock
  w.u8(1); // schema version
  w.ascii(context.deckContentHash);
  w.u32(state.seed);
  w.u32(state.tick);
  w.u32(context.width);
  w.u32(context.height);

  // Show / visual state
  w.enumValue(SCENES, state.scene);
  w.enumValue(MODES, state.mode);
  w.enumValue(COLORS, state.colorPreset);
  w.norm(state.colorDrive);
  w.u32(state.fishCount);
  w.scaled(state.fishSize, 1000);
  w.scaled(state.speed, 1000);
  w.scaled(state.depth, 1000);
  w.bool(state.dive);
  w.bool(state.blackout);
  w.u8(state.selectedSpecies);
  w.enumValue(SWIMS, state.swimType);
  w.enumValue(SWARMS, state.swarm);

  // Transition state
  w.norm(state.sceneMix);
  w.norm(state.currentDive);
  w.enumValue(SWARMS, state.observedSwarm);
  w.u8(state.swarmFrom);
  w.u8(state.swarmTo);
  w.norm(state.swarmMix);
  w.u32(state.swarmTransitionStartTick);

  // Beat / audio state (T0-B)
  w.scaled(state.bpm, 1000);
  w.norm(state.beatPhase);
  w.norm(state.confidence);
  w.norm(state.flux);
  w.norm(state.energy);
  w.norm(state.rawKick);
  w.norm(state.rawBass);
  w.norm(state.rawMid);
  w.norm(state.rawHigh);
  w.norm(state.smoothKick);
  w.norm(state.smoothBass);
  w.norm(state.smoothHigh);
  w.norm(state.kickLuma);
  w.norm(state.highLuma);

  // Values entering the renderer
  w.scaled(snapshot.uTime, 1000);
  w.u32(snapshot.uSegments);
  w.norm(snapshot.uKick);
  w.norm(snapshot.uBass);
  w.norm(snapshot.uHigh);
  w.norm(snapshot.uDive);
  w.u8(snapshot.uMode);
  w.norm(snapshot.uDrive);
  w.u8(snapshot.uColorPreset);
  w.norm(snapshot.uSceneMix);
  w.scaled(snapshot.uSpeed, 1000);
  w.scaled(snapshot.uFishSize, 1000);
  w.scaled(snapshot.uDepth, 1000);
  w.u8(snapshot.uSelectedSpecies);
  w.u8(snapshot.uSwimFocus);
  w.u8(snapshot.uSwarmFrom);
  w.u8(snapshot.uSwarmTo);
  w.norm(snapshot.uSwarmMix);
  w.norm(snapshot.uMandalaPopulation);
  w.scaled(snapshot.uAspect, 65536);
  w.u32(snapshot.mandalaCount);
  w.u32(snapshot.freeSwimCount);
  w.u32(snapshot.instanceCount);
  w.scaled(snapshot.toneMappingExposure, 1000);

  return Uint8Array.from(w.bytes);
}

export function hashBytes(bytes: Uint8Array): string {
  let hash = FNV_OFFSET;
  for (const byte of bytes) hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & MASK;
  return hash.toString(16).padStart(16, "0");
}

export function hashState(
  state: EngineState,
  snapshot: RenderSnapshot,
  context: HashContext,
): string {
  return hashBytes(encodeState(state, snapshot, context));
}
