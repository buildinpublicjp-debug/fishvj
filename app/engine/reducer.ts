import type { EngineEvent, EngineState, ParamPayload } from "./types";
import { DEFAULT_SEED } from "./types";
import { swarmValue } from "./frame";

export function createInitialEngineState(seed = DEFAULT_SEED): EngineState {
  return {
    tick: 0,
    seed: seed >>> 0,
    scene: "MANDALA",
    mode: "MYSTIC",
    colorPreset: "PUNCH",
    colorDrive: 0.72,
    fishCount: 800,
    fishSize: 1.5,
    speed: 0.68,
    depth: 0.74,
    dive: false,
    blackout: false,
    selectedSpecies: 0,
    swimType: "SCHOOL",
    swarm: "SPIRAL",
    currentDive: 0,
    sceneMix: 0,
    observedSwarm: "SPIRAL",
    swarmFrom: 0,
    swarmTo: 0,
    swarmMix: 1,
    swarmTransitionStartTick: 0,
    bpm: 0,
    beatPhase: 0,
    confidence: 0,
    flux: 0,
    energy: 0,
    rawKick: 0,
    rawBass: 0,
    rawMid: 0,
    rawHigh: 0,
    smoothKick: 0,
    smoothBass: 0,
    smoothHigh: 0,
    kickLuma: 0,
    highLuma: 0,
  };
}

function reduceParam(state: EngineState, payload: ParamPayload): EngineState {
  if (payload.id === "fishSelection") {
    return {
      ...state,
      selectedSpecies: payload.selectedSpecies,
      swimType: payload.swimType,
    };
  }
  if (payload.id === "swarm" && payload.value !== state.observedSwarm) {
    return {
      ...state,
      swarm: payload.value,
      observedSwarm: payload.value,
      swarmFrom: state.swarmMix >= 0.5 ? state.swarmTo : state.swarmFrom,
      swarmTo: swarmValue(payload.value),
      swarmMix: 0,
      swarmTransitionStartTick: state.tick,
    };
  }
  return { ...state, [payload.id]: payload.value };
}

export function reduceEvent(state: EngineState, event: EngineEvent): EngineState {
  switch (event.type) {
    case "mode":
      return { ...state, mode: event.payload.value };
    case "scene":
      return { ...state, scene: event.payload.value };
    case "macro":
      return { ...state, colorPreset: event.payload.value };
    case "param":
      return reduceParam(state, event.payload);
    case "oneshot": {
      const defaults = createInitialEngineState(state.seed);
      return {
        ...state,
        scene: defaults.scene,
        mode: defaults.mode,
        colorPreset: defaults.colorPreset,
        colorDrive: defaults.colorDrive,
        fishCount: defaults.fishCount,
        fishSize: defaults.fishSize,
        speed: defaults.speed,
        depth: defaults.depth,
        dive: defaults.dive,
        blackout: defaults.blackout,
        selectedSpecies: defaults.selectedSpecies,
        swimType: defaults.swimType,
        swarm: defaults.swarm,
      };
    }
    case "beat": {
      if (event.payload.kind === "bands") {
        const [rawKick, rawBass, rawMid, rawHigh] = event.payload.bands;
        return { ...state, rawKick, rawBass, rawMid, rawHigh };
      }
      return {
        ...state,
        bpm: event.payload.bpm,
        beatPhase: event.payload.phase,
        confidence: event.payload.confidence,
        flux: event.payload.flux,
        energy: event.payload.energy,
      };
    }
    case "verb":
    case "space":
      return state;
  }
}
