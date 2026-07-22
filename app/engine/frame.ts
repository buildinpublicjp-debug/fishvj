import type {
  EngineState,
  FrameContext,
  ModeName,
  RenderSnapshot,
  SceneMode,
  SwarmType,
  SwimType,
} from "./types";
import { SIM_HZ } from "./types";

const MAX_SOURCE_FISH = 2000;
const SWARM_TRANSITION_TICKS = 90;
const SCENE_ALPHA = Math.min(1, 1000 / SIM_HZ / 360);
const DIVE_ALPHA = Math.min(1, 1000 / SIM_HZ / 760);

export function modeValue(mode: ModeName) {
  return mode === "MYSTIC" ? 0 : mode === "SENSUAL" ? 1 : 2;
}

export function segmentValue(mode: ModeName) {
  return mode === "MYSTIC" ? 6 : mode === "SENSUAL" ? 8 : 12;
}

export function colorValue(color: EngineState["colorPreset"]) {
  return color === "CLEAN" ? 0 : color === "PUNCH" ? 1 : color === "ACID" ? 2 : 3;
}

export function swimValue(swim: SwimType) {
  return swim === "SCHOOL" ? 0 : swim === "GLIDE" ? 1 : swim === "WAVE" ? 2 : 3;
}

export function swarmValue(swarm: SwarmType) {
  return swarm === "SPIRAL" ? 0 : swarm === "VORTEX" ? 1 : swarm === "WAVE" ? 2 : 3;
}

export function sceneValue(scene: SceneMode) {
  return scene === "MANDALA" ? 0 : 1;
}

export function advanceEngineTick(state: EngineState): EngineState {
  const tick = state.tick + 1;
  let observedSwarm = state.observedSwarm;
  let swarmFrom = state.swarmFrom;
  let swarmTo = state.swarmTo;
  let swarmTransitionStartTick = state.swarmTransitionStartTick;

  if (state.swarm !== observedSwarm) {
    swarmFrom = state.swarmMix >= 0.5 ? state.swarmTo : state.swarmFrom;
    swarmTo = swarmValue(state.swarm);
    observedSwarm = state.swarm;
    swarmTransitionStartTick = tick;
  }

  const swarmMix = Math.min(
    1,
    Math.max(0, (tick - swarmTransitionStartTick) / SWARM_TRANSITION_TICKS),
  );
  const targetScene = sceneValue(state.scene);
  const sceneMix = state.sceneMix + (targetScene - state.sceneMix) * SCENE_ALPHA;
  const targetDive = state.dive ? 1 : 0;
  const currentDive = state.currentDive + (targetDive - state.currentDive) * DIVE_ALPHA;

  return {
    ...state,
    tick,
    currentDive,
    sceneMix,
    observedSwarm,
    swarmFrom,
    swarmTo,
    swarmMix,
    swarmTransitionStartTick,
  };
}

export function createRenderSnapshot(
  state: Readonly<EngineState>,
  context: FrameContext = {},
): RenderSnapshot {
  const width = Math.max(1, Math.floor(context.width ?? 1));
  const height = Math.max(1, Math.floor(context.height ?? 1));
  const audio = context.audio ?? { kick: 0, bass: 0, high: 0 };
  const segments = segmentValue(state.mode);
  const mandalaCount = Math.min(
    MAX_SOURCE_FISH,
    Math.max(24, Math.ceil(state.fishCount / (segments * 2))),
  );
  const freeSwimCount = Math.min(MAX_SOURCE_FISH, Math.max(100, state.fishCount));

  return {
    tick: state.tick,
    uTime: state.tick / SIM_HZ,
    uAspect: width / height,
    uSegments: segments,
    uKick: audio.kick,
    uBass: audio.bass,
    uHigh: audio.high,
    uDive: state.currentDive,
    uMode: modeValue(state.mode),
    uDrive: state.colorDrive,
    uColorPreset: colorValue(state.colorPreset),
    uSceneMix: state.sceneMix,
    uSpeed: state.speed,
    uFishSize: state.fishSize,
    uDepth: state.depth,
    uSelectedSpecies: state.selectedSpecies,
    uSwimFocus: swimValue(state.swimType),
    uSwarmFrom: state.swarmFrom,
    uSwarmTo: state.swarmTo,
    uSwarmMix: state.swarmMix,
    uMandalaPopulation: mandalaCount / MAX_SOURCE_FISH,
    uResolution: [width, height],
    mandalaCount,
    freeSwimCount,
    instanceCount:
      state.sceneMix > 0.01 ? Math.max(mandalaCount, freeSwimCount) : mandalaCount,
    toneMappingExposure:
      state.colorPreset === "DEEP" ? 0.86 : state.colorPreset === "PUNCH" ? 1.24 : 1.1,
  };
}
