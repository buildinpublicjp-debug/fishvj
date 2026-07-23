import type {
  BeatPayload,
  EngineEventInput,
  ParamPayload,
  ProducerId,
  SpacePayload,
} from "./types";

// S1 enabled keys/ui; S2 adds the audio and replay producers (FISHVJ_DESIGN_V2.md §4.2).
const ENABLED_PRODUCERS = new Set<ProducerId>(["keys", "ui", "audio", "replay"]);
const MODES = new Set(["MYSTIC", "SENSUAL", "EUPHORIC"]);
const SCENES = new Set(["MANDALA", "FREE_SWIM"]);
const MACROS = new Set(["CLEAN", "PUNCH", "ACID", "DEEP"]);
const SWIMS = new Set(["SCHOOL", "GLIDE", "WAVE", "FLOAT"]);
const SWARMS = new Set(["SPIRAL", "VORTEX", "WAVE", "BLOOM"]);

function finiteRange(value: number, min: number, max: number, label: string) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}`);
  }
}

function validateParam(payload: ParamPayload) {
  if (payload.id === "fishSelection") {
    if (payload.update !== "atomic") throw new RangeError("fishSelection must be atomic");
  } else if (payload.update !== "absolute") {
    throw new RangeError("parameter must use an absolute update");
  }
  switch (payload.id) {
    case "colorDrive":
      finiteRange(payload.value, 0, 1, payload.id);
      break;
    case "fishCount":
      finiteRange(payload.value, 100, 2000, payload.id);
      if (!Number.isInteger(payload.value)) throw new RangeError("fishCount must be an integer");
      break;
    case "fishSize":
      finiteRange(payload.value, 0.5, 3, payload.id);
      break;
    case "speed":
      finiteRange(payload.value, 0.2, 1.6, payload.id);
      break;
    case "depth":
      finiteRange(payload.value, 0.15, 1, payload.id);
      break;
    case "dive":
    case "blackout":
      if (typeof payload.value !== "boolean") throw new TypeError("toggle parameter must be boolean");
      break;
    case "swimType":
      if (!SWIMS.has(payload.value)) throw new RangeError("invalid swimType");
      break;
    case "swarm":
      if (!SWARMS.has(payload.value)) throw new RangeError("invalid swarm");
      break;
    case "fishSelection":
      finiteRange(payload.selectedSpecies, 0, 7, "selectedSpecies");
      if (!Number.isInteger(payload.selectedSpecies)) {
        throw new RangeError("selectedSpecies must be an integer");
      }
      if (!SWIMS.has(payload.swimType)) throw new RangeError("invalid fishSelection swimType");
      break;
    default:
      throw new RangeError("unknown param id");
  }
}

function validateBeat(payload: BeatPayload) {
  if (payload.kind === "bands") {
    if (payload.bands.length !== 4) throw new RangeError("beat bands must contain four values");
    payload.bands.forEach((value, index) => finiteRange(value, 0, 1, `bands[${index}]`));
    return;
  }
  finiteRange(payload.bpm, 20, 300, "bpm");
  if (!Number.isFinite(payload.phase) || payload.phase < 0 || payload.phase >= 1) {
    throw new RangeError("phase must be in [0, 1)");
  }
  finiteRange(payload.confidence, 0, 1, "confidence");
  finiteRange(payload.flux, 0, 1, "flux");
  finiteRange(payload.energy, 0, 1, "energy");
}

function validateSpace(payload: SpacePayload) {
  if (!(payload.grid instanceof Uint8Array) || payload.grid.length !== 64) {
    throw new RangeError("space grid must be Uint8Array(64)");
  }
  finiteRange(payload.energy, 0, 255, "space energy");
  finiteRange(payload.silRatio, 0, 255, "space silRatio");
  if (!Number.isInteger(payload.energy) || !Number.isInteger(payload.silRatio)) {
    throw new RangeError("space scalars must be u8 integers");
  }
}

export function validateEngineEventInput(input: EngineEventInput) {
  if (input.v !== 1) throw new RangeError("EngineEvent schema version must be 1");
  if (!ENABLED_PRODUCERS.has(input.producerId)) {
    throw new RangeError(`producer ${input.producerId} is not enabled`);
  }
  if (input.sourceT !== undefined && (!Number.isFinite(input.sourceT) || input.sourceT < 0)) {
    throw new RangeError("sourceT must be a non-negative finite millisecond value");
  }

  switch (input.type) {
    case "mode":
      if (input.payload.update !== "absolute" || !MODES.has(input.payload.value)) {
        throw new RangeError("invalid mode payload");
      }
      break;
    case "scene":
      if (input.payload.update !== "absolute" || !SCENES.has(input.payload.value)) {
        throw new RangeError("invalid scene payload");
      }
      break;
    case "macro":
      if (input.payload.update !== "absolute" || !MACROS.has(input.payload.value)) {
        throw new RangeError("invalid macro payload");
      }
      break;
    case "param":
      validateParam(input.payload);
      break;
    case "oneshot":
      if (input.payload.id !== "reset" || input.payload.update !== "trigger") {
        throw new RangeError("invalid oneshot payload");
      }
      break;
    case "verb":
      if (!input.payload.id) throw new RangeError("verb id must not be empty");
      if (input.payload.strengthQ8 !== undefined) {
        finiteRange(input.payload.strengthQ8, 0, 255, "strengthQ8");
        if (!Number.isInteger(input.payload.strengthQ8)) {
          throw new RangeError("strengthQ8 must be an integer");
        }
      }
      break;
    case "beat":
      validateBeat(input.payload);
      break;
    case "space":
      validateSpace(input.payload);
      break;
    default:
      throw new RangeError("unknown EngineEvent type");
  }
}
