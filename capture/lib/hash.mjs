// Canonical semantic-state hash for the S1a determinism check.
//
// Scope: this is the S1-available subset of FISHVJ_DESIGN_V2.md §5.2. Beat /
// audio state, space state, verb state, deck ID and atlas content hash are not
// yet part of EngineState (S2 / S3), so they are absent here. The canonical
// encoding rules follow §5.3: enums as fixed-table u8, booleans as u8 0/1,
// normalized floats as round(value * 65535), everything written in a fixed
// field order, hashed with 64-bit FNV-1a.
const SCENES = ["MANDALA", "FREE_SWIM"];
const MODES = ["MYSTIC", "SENSUAL", "EUPHORIC"];
const COLORS = ["CLEAN", "PUNCH", "ACID", "DEEP"];
const SWIMS = ["SCHOOL", "GLIDE", "WAVE", "FLOAT"];
const SWARMS = ["SPIRAL", "VORTEX", "WAVE", "BLOOM"];

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

class Writer {
  constructor() {
    this.bytes = [];
  }

  u8(value) {
    this.bytes.push(value & 0xff);
    return this;
  }

  u32(value) {
    const v = value >>> 0;
    this.bytes.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
    return this;
  }

  /** Normalized [0,1] float. */
  norm(value) {
    return this.u32(Math.round(value * 65535));
  }

  /** Non-normalized float, quantized by an explicit per-field scale. */
  scaled(value, scale) {
    return this.u32(Math.round(value * scale));
  }

  bool(value) {
    return this.u8(value ? 1 : 0);
  }

  enumValue(table, value) {
    const index = table.indexOf(value);
    if (index < 0) throw new Error(`unknown enum value ${value}`);
    return this.u8(index);
  }
}

export function encodeSample(sample) {
  const { state, snapshot } = sample;
  const w = new Writer();

  // Session / clock
  w.u8(1); // schema version
  w.u32(state.seed);
  w.u32(state.tick);
  w.u32(snapshot.uResolution[0]);
  w.u32(snapshot.uResolution[1]);
  w.scaled(snapshot.uAspect, 65536);

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
  w.u32(snapshot.mandalaCount);
  w.u32(snapshot.freeSwimCount);
  w.u32(snapshot.instanceCount);
  w.scaled(snapshot.toneMappingExposure, 1000);

  return Uint8Array.from(w.bytes);
}

export function hashBytes(bytes) {
  let hash = FNV_OFFSET;
  for (const byte of bytes) {
    hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & MASK;
  }
  return hash.toString(16).padStart(16, "0");
}

export function hashSample(sample) {
  return hashBytes(encodeSample(sample));
}
