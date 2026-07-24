export const SIM_HZ = 60;
export const TICK_MS = 1000 / SIM_HZ;
export const DEFAULT_SEED = 0x46495348;

// T0-B (FISHVJ_DESIGN_V2.md §2.2). Audio bands are quantized to 15Hz and
// injected every 4 ticks; smoothing time constants are derived from the 60fps
// coefficients; the luma-facing values pass through a soft slew limiter.
export const AUDIO_HZ = 15;
export const AUDIO_TICK_INTERVAL = SIM_HZ / AUDIO_HZ; // 4
export const TAU_KICK_SEC = 0.075;
export const TAU_BASS_SEC = 0.111;
export const TAU_HIGH_SEC = 0.093;
export const SLEW_KICK_PER_SEC = 4.0;
export const SLEW_HIGH_PER_SEC = 2.0;

export type ModeName = "MYSTIC" | "SENSUAL" | "EUPHORIC";
export type SceneMode = "MANDALA" | "FREE_SWIM";
export type ColorPreset = "CLEAN" | "PUNCH" | "ACID" | "DEEP";
export type SwimType = "SCHOOL" | "GLIDE" | "WAVE" | "FLOAT";
export type SwarmType = "SPIRAL" | "VORTEX" | "WAVE" | "BLOOM";

export type ProducerId =
  | "keys"
  | "ui"
  | "midi"
  | "audio"
  | "replay"
  | "cv"
  | "sim"
  | "djlink"
  | "bot";

export type ModePayload = { update: "absolute"; value: ModeName };
export type ScenePayload = { update: "absolute"; value: SceneMode };
export type MacroPayload = { update: "absolute"; value: ColorPreset };

export type ParamPayload =
  | { id: "colorDrive"; update: "absolute"; value: number }
  | { id: "fishCount"; update: "absolute"; value: number }
  | { id: "fishSize"; update: "absolute"; value: number }
  | { id: "speed"; update: "absolute"; value: number }
  | { id: "depth"; update: "absolute"; value: number }
  | { id: "dive"; update: "absolute"; value: boolean }
  | { id: "blackout"; update: "absolute"; value: boolean }
  | { id: "swimType"; update: "absolute"; value: SwimType }
  | { id: "swarm"; update: "absolute"; value: SwarmType }
  | {
      id: "fishSelection";
      update: "atomic";
      selectedSpecies: number;
      swimType: SwimType;
    };

export type OneShotPayload = { id: "reset"; update: "trigger" };
export type VerbPayload = {
  id: string;
  update: "start" | "stop" | "trigger";
  strengthQ8?: number;
};
export type BeatPayload =
  | {
      kind: "clock";
      bpm: number;
      phase: number;
      confidence: number;
      flux: number;
      energy: number;
    }
  | { kind: "bands"; bands: [number, number, number, number] };
export type SpacePayload = {
  grid: Uint8Array;
  energy: number;
  silRatio: number;
};

export type EngineEventBody =
  | { type: "mode"; payload: ModePayload }
  | { type: "scene"; payload: ScenePayload }
  | { type: "macro"; payload: MacroPayload }
  | { type: "param"; payload: ParamPayload }
  | { type: "oneshot"; payload: OneShotPayload }
  | { type: "verb"; payload: VerbPayload }
  | { type: "beat"; payload: BeatPayload }
  | { type: "space"; payload: SpacePayload };

export type EngineEventInput = EngineEventBody & {
  producerId: ProducerId;
  sourceT?: number;
  v: 1;
};

export type EngineEvent = EngineEventBody & {
  t: number;
  sourceT: number;
  seq: number;
  producerId: ProducerId;
  v: 1;
};

export type EngineState = {
  tick: number;
  seed: number;
  scene: SceneMode;
  mode: ModeName;
  colorPreset: ColorPreset;
  colorDrive: number;
  fishCount: number;
  fishSize: number;
  speed: number;
  depth: number;
  dive: boolean;
  blackout: boolean;
  selectedSpecies: number;
  swimType: SwimType;
  swarm: SwarmType;
  currentDive: number;
  sceneMix: number;
  observedSwarm: SwarmType;
  swarmFrom: number;
  swarmTo: number;
  swarmMix: number;
  swarmTransitionStartTick: number;
  // Beat/audio state (T0-B). Owned by the engine so it is deterministic,
  // hashed, and reproduced identically on replay.
  bpm: number;
  beatPhase: number;
  confidence: number;
  flux: number;
  energy: number;
  rawKick: number;
  rawBass: number;
  rawMid: number;
  rawHigh: number;
  smoothKick: number;
  smoothBass: number;
  smoothHigh: number;
  kickLuma: number;
  highLuma: number;
};

export type AudioLevels = {
  kick: number;
  bass: number;
  mid: number;
  high: number;
};

export type FrameContext = {
  width?: number;
  height?: number;
};

export type RenderSnapshot = {
  tick: number;
  uTime: number;
  uAspect: number;
  uSegments: number;
  uKick: number;
  uBass: number;
  uHigh: number;
  uDive: number;
  uMode: number;
  uDrive: number;
  uColorPreset: number;
  uSceneMix: number;
  uSpeed: number;
  uFishSize: number;
  uDepth: number;
  uSelectedSpecies: number;
  uSwimFocus: number;
  uSwarmFrom: number;
  uSwarmTo: number;
  uSwarmMix: number;
  uMandalaPopulation: number;
  uResolution: readonly [number, number];
  mandalaCount: number;
  freeSwimCount: number;
  instanceCount: number;
  toneMappingExposure: number;
};

export type EngineStore = {
  dispatch(input: EngineEventInput): EngineEvent;
  advanceTick(): RenderSnapshot;
  getState(): Readonly<EngineState>;
  getRenderSnapshot(context?: FrameContext): Readonly<RenderSnapshot>;
  subscribe(listener: () => void): () => void;
};
