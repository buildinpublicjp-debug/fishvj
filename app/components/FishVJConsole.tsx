"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AudioLevels,
  ColorPreset,
  FishCanvas,
  FxState,
  ModeName,
  PerformanceState,
  SceneMode,
  SwarmType,
  SwimType,
  VisualConfig,
} from "./FishCanvas";

const FISH = [
  { name: "SARDINE", motion: "SCHOOL" },
  { name: "TUNA", motion: "GLIDE" },
  { name: "BREAM", motion: "FLOAT" },
  { name: "SWORDFISH", motion: "GLIDE" },
  { name: "PUFFER", motion: "FLOAT" },
  { name: "RIBBON", motion: "WAVE" },
  { name: "ANGEL", motion: "FLOAT" },
  { name: "MACKEREL", motion: "SCHOOL" },
] as const;

const MODES: ModeName[] = ["MYSTIC", "SENSUAL", "EUPHORIC"];
const SCENES: { id: SceneMode; label: string; hint: string }[] = [
  { id: "MANDALA", label: "MANDALA", hint: "RADIAL MIRROR" },
  { id: "FREE_SWIM", label: "FREE SWIM", hint: "OPEN WATER" },
];
const COLORS: ColorPreset[] = ["CLEAN", "PUNCH", "ACID", "DEEP"];
const SWIMS: SwimType[] = ["SCHOOL", "GLIDE", "WAVE", "FLOAT"];
const SWARMS: SwarmType[] = ["SPIRAL", "VORTEX", "WAVE", "BLOOM"];
const FREE_SWIM_STYLES: Record<SwarmType, string> = {
  SPIRAL: "CRUISE",
  VORTEX: "CURRENT",
  WAVE: "CROSS",
  BLOOM: "DRIFT",
};
const EMPTY_LEVELS: AudioLevels = { kick: 0, bass: 0, mid: 0, high: 0 };

const FX_DEFS: ReadonlyArray<{
  id: keyof FxState;
  label: string;
  hint: string;
  symbol: string;
}> = [
  { id: "feedback", label: "FEEDBACK", hint: "TIME TRAIL", symbol: "∞" },
  { id: "twist", label: "TWIST", hint: "POLAR WARP", symbol: "↻" },
  { id: "chroma", label: "CHROMA", hint: "RGB SPLIT", symbol: "◒" },
  { id: "pixel", label: "PIXEL", hint: "GRID CRUSH", symbol: "▦" },
  { id: "ripple", label: "RIPPLE", hint: "WATER WAVE", symbol: "≋" },
  { id: "glitch", label: "GLITCH", hint: "BLOCK SHIFT", symbol: "⌁" },
  { id: "zoom", label: "ZOOM", hint: "BEAT PULSE", symbol: "◎" },
  { id: "mirror", label: "MIRROR", hint: "QUAD FOLD", symbol: "◇" },
];

const INITIAL_FX: FxState = {
  feedback: 0,
  twist: 0,
  chroma: 0,
  pixel: 0,
  ripple: 0,
  glitch: 0,
  zoom: 0,
  mirror: 0,
};

type ControlView = "CORE" | "FX" | "CUES";

type CuePreset = {
  name: string;
  scene: SceneMode;
  modeBlend: number;
  colorPreset: ColorPreset;
  colorDrive: number;
  fishSize: number;
  speed: number;
  depth: number;
  swimType: SwimType;
  swarm: SwarmType;
  fx: FxState;
};

const DEFAULT_CUES: CuePreset[] = [
  {
    name: "RITUAL",
    scene: "MANDALA",
    modeBlend: 0,
    colorPreset: "PUNCH",
    colorDrive: 0.72,
    fishSize: 1.5,
    speed: 0.68,
    depth: 0.74,
    swimType: "SCHOOL",
    swarm: "SPIRAL",
    fx: { ...INITIAL_FX },
  },
  {
    name: "ABYSS",
    scene: "MANDALA",
    modeBlend: 0.45,
    colorPreset: "DEEP",
    colorDrive: 0.58,
    fishSize: 1.75,
    speed: 0.42,
    depth: 0.94,
    swimType: "FLOAT",
    swarm: "VORTEX",
    fx: { ...INITIAL_FX, feedback: 0.72, ripple: 0.22, zoom: 0.16 },
  },
  {
    name: "ACID",
    scene: "MANDALA",
    modeBlend: 1.35,
    colorPreset: "ACID",
    colorDrive: 0.96,
    fishSize: 1.42,
    speed: 0.94,
    depth: 0.62,
    swimType: "WAVE",
    swarm: "WAVE",
    fx: { ...INITIAL_FX, chroma: 0.7, ripple: 0.52, twist: 0.28 },
  },
  {
    name: "OPEN SEA",
    scene: "FREE_SWIM",
    modeBlend: 0.72,
    colorPreset: "CLEAN",
    colorDrive: 0.4,
    fishSize: 1.9,
    speed: 0.58,
    depth: 0.48,
    swimType: "GLIDE",
    swarm: "SPIRAL",
    fx: { ...INITIAL_FX, ripple: 0.16, feedback: 0.18 },
  },
  {
    name: "VORTEX",
    scene: "MANDALA",
    modeBlend: 1.78,
    colorPreset: "PUNCH",
    colorDrive: 0.88,
    fishSize: 1.24,
    speed: 1.25,
    depth: 0.96,
    swimType: "SCHOOL",
    swarm: "VORTEX",
    fx: { ...INITIAL_FX, feedback: 0.48, twist: 0.68, zoom: 0.72 },
  },
  {
    name: "DIGITAL",
    scene: "FREE_SWIM",
    modeBlend: 1.12,
    colorPreset: "ACID",
    colorDrive: 0.82,
    fishSize: 1.62,
    speed: 0.9,
    depth: 0.38,
    swimType: "GLIDE",
    swarm: "WAVE",
    fx: { ...INITIAL_FX, pixel: 0.78, glitch: 0.66, chroma: 0.34 },
  },
  {
    name: "BLOOM DROP",
    scene: "MANDALA",
    modeBlend: 2,
    colorPreset: "PUNCH",
    colorDrive: 1,
    fishSize: 2.15,
    speed: 1.38,
    depth: 0.78,
    swimType: "SCHOOL",
    swarm: "BLOOM",
    fx: { ...INITIAL_FX, feedback: 0.36, zoom: 0.86, ripple: 0.35 },
  },
  {
    name: "PRISM",
    scene: "MANDALA",
    modeBlend: 1.56,
    colorPreset: "ACID",
    colorDrive: 0.92,
    fishSize: 1.38,
    speed: 0.78,
    depth: 0.66,
    swimType: "WAVE",
    swarm: "SPIRAL",
    fx: { ...INITIAL_FX, mirror: 0.88, chroma: 0.76, twist: 0.46 },
  },
];

type OneShotPad = "strobe" | "rush" | "scatter" | "hueFlip" | "kaleidoBurst";

const INITIAL_PERFORMANCE: PerformanceState = {
  strobeStartedAt: 0,
  rushStartedAt: 0,
  scatterStartedAt: 0,
  hueFlipStartedAt: 0,
  kaleidoBurstStartedAt: 0,
  slowMo: false,
};

const PAD_DURATION: Record<OneShotPad, number> = {
  strobe: 1820,
  rush: 500,
  scatter: 1300,
  hueFlip: 200,
  kaleidoBurst: 2000,
};

const PAD_FIELD: Record<OneShotPad, keyof PerformanceState> = {
  strobe: "strobeStartedAt",
  rush: "rushStartedAt",
  scatter: "scatterStartedAt",
  hueFlip: "hueFlipStartedAt",
  kaleidoBurst: "kaleidoBurstStartedAt",
};

const INITIAL_ACTIVE_PADS: Record<OneShotPad, boolean> = {
  strobe: false,
  rush: false,
  scatter: false,
  hueFlip: false,
  kaleidoBurst: false,
};

const ONE_SHOT_PADS: ReadonlyArray<{
  id: OneShotPad;
  keyLabel: string;
  label: string;
  symbol: string;
}> = [
  { id: "strobe", keyLabel: "T", label: "STROBE", symbol: "✦" },
  { id: "rush", keyLabel: "G", label: "RUSH", symbol: "≫" },
  { id: "scatter", keyLabel: "H", label: "SCATTER", symbol: "↗" },
  { id: "hueFlip", keyLabel: "J", label: "HUE FLIP", symbol: "◒" },
  { id: "kaleidoBurst", keyLabel: "K", label: "KALEIDO", symbol: "✺" },
];

type KeyboardFader = "mode" | "color" | "speed" | "depth" | "size";

const FADER_KEYS = new Set([
  "z",
  "x",
  "c",
  "v",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "[",
  "]",
]);

function normalizeFaderKey(key: string) {
  const normalized = key.length === 1 ? key.toLowerCase() : key;
  return FADER_KEYS.has(normalized) ? normalized : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function modeFromBlend(value: number): ModeName {
  return MODES[Math.round(clamp(value, 0, 2))];
}

function segmentsFromBlend(value: number) {
  const blend = clamp(value, 0, 2);
  return blend <= 1 ? 6 + blend * 2 : 8 + (blend - 1) * 4;
}

function sanitizeCue(value: unknown, fallback: CuePreset): CuePreset {
  if (!value || typeof value !== "object") return fallback;
  const cue = value as Partial<CuePreset>;
  const number = (candidate: unknown, safe: number, min: number, max: number) =>
    typeof candidate === "number" && Number.isFinite(candidate)
      ? clamp(candidate, min, max)
      : safe;
  const savedFx =
    cue.fx && typeof cue.fx === "object"
      ? cue.fx as Partial<FxState>
      : {};
  const nextFx = Object.fromEntries(
    FX_DEFS.map(({ id }) => [
      id,
      number(savedFx[id], fallback.fx[id], 0, 1),
    ]),
  ) as FxState;

  return {
    name: typeof cue.name === "string" ? cue.name.slice(0, 18) : fallback.name,
    scene: SCENES.some(({ id }) => id === cue.scene) ? cue.scene as SceneMode : fallback.scene,
    modeBlend: number(cue.modeBlend, fallback.modeBlend, 0, 2),
    colorPreset: COLORS.includes(cue.colorPreset as ColorPreset)
      ? cue.colorPreset as ColorPreset
      : fallback.colorPreset,
    colorDrive: number(cue.colorDrive, fallback.colorDrive, 0, 1),
    fishSize: number(cue.fishSize, fallback.fishSize, 0.5, 3),
    speed: number(cue.speed, fallback.speed, 0.2, 1.6),
    depth: number(cue.depth, fallback.depth, 0.15, 1),
    swimType: SWIMS.includes(cue.swimType as SwimType)
      ? cue.swimType as SwimType
      : fallback.swimType,
    swarm: SWARMS.includes(cue.swarm as SwarmType)
      ? cue.swarm as SwarmType
      : fallback.swarm,
    fx: nextFx,
  };
}

type AudioRuntime = {
  context: AudioContext;
  analyser: AnalyserNode;
  source: AudioNode;
  stream?: MediaStream;
  audio?: HTMLAudioElement;
  frame: number;
};

function averageBand(
  bins: Uint8Array<ArrayBuffer>,
  sampleRate: number,
  fftSize: number,
  low: number,
  high: number,
) {
  const hzPerBin = sampleRate / fftSize;
  const start = Math.max(0, Math.floor(low / hzPerBin));
  const end = Math.min(bins.length - 1, Math.ceil(high / hzPerBin));
  let total = 0;
  for (let index = start; index <= end; index += 1) total += bins[index];
  return total / Math.max(1, end - start + 1) / 255;
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-control">
      <span className="range-label">{label}</span>
      <span className="range-row">
        <input
          aria-label={label}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <output>{display}</output>
      </span>
    </label>
  );
}

export function FishVJConsole() {
  const [scene, setScene] = useState<SceneMode>("MANDALA");
  const [modeBlend, setModeBlend] = useState(0);
  const [colorPreset, setColorPreset] = useState<ColorPreset>("PUNCH");
  const [colorDrive, setColorDrive] = useState(0.72);
  const [fishCount, setFishCount] = useState(800);
  const [fishSize, setFishSize] = useState(1.5);
  const [speed, setSpeed] = useState(0.68);
  const [depth, setDepth] = useState(0.74);
  const [dive, setDive] = useState(false);
  const [blackout, setBlackout] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState<number[]>([0]);
  const [swimType, setSwimType] = useState<SwimType>("SCHOOL");
  const [swarm, setSwarm] = useState<SwarmType>("SPIRAL");
  const [fps, setFps] = useState(60);
  const [audioLevels, setAudioLevels] = useState<AudioLevels>(EMPTY_LEVELS);
  const [audioInput, setAudioInput] = useState("demo");
  const [audioStatus, setAudioStatus] = useState("DEMO PULSE");
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [bpm] = useState(138);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [performanceState, setPerformanceState] = useState<PerformanceState>(INITIAL_PERFORMANCE);
  const [activePads, setActivePads] = useState(INITIAL_ACTIVE_PADS);
  const [holdBlackout, setHoldBlackout] = useState(false);
  const [heldFaderKeys, setHeldFaderKeys] = useState<string[]>([]);
  const [fx, setFx] = useState<FxState>(INITIAL_FX);
  const [controlView, setControlView] = useState<ControlView>("CORE");
  const [selectedFx, setSelectedFx] = useState<keyof FxState>("feedback");
  const [cues, setCues] = useState<CuePreset[]>(DEFAULT_CUES);
  const [activeCue, setActiveCue] = useState(0);
  const [cueMorphTime, setCueMorphTime] = useState(2.4);
  const [autoPilot, setAutoPilot] = useState(false);
  const [autoBeats, setAutoBeats] = useState<4 | 8 | 16>(8);
  const [spaceLayer, setSpaceLayer] = useState(false);
  const [fxAdjusting, setFxAdjusting] = useState(0);
  const [cueStatus, setCueStatus] = useState("F1–F8 RECALL · SHIFT SAVE");
  const outputRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRuntimeRef = useRef<AudioRuntime | null>(null);
  const demoFrameRef = useRef(0);
  const beatStartRef = useRef(performance.now());
  const padTimersRef = useRef<Partial<Record<OneShotPad, ReturnType<typeof setTimeout>>>>({});
  const heldFaderKeysRef = useRef(new Set<string>());
  const fxDirectionRef = useRef(0);
  const spaceLayerRef = useRef(false);
  const selectedFxRef = useRef<keyof FxState>("feedback");
  const cueTransitionFrameRef = useRef(0);
  const recallCueRef = useRef<(index: number) => void>(() => {});
  const cuesRef = useRef<CuePreset[]>(DEFAULT_CUES);
  const liveSnapshotRef = useRef<CuePreset>(DEFAULT_CUES[0]);
  const mode = modeFromBlend(modeBlend);
  const kaleidoSegments = segmentsFromBlend(modeBlend);
  selectedFxRef.current = selectedFx;
  cuesRef.current = cues;
  liveSnapshotRef.current = {
    name: cues[activeCue]?.name ?? "LIVE",
    scene,
    modeBlend,
    colorPreset,
    colorDrive,
    fishSize,
    speed,
    depth,
    swimType,
    swarm,
    fx: { ...fx },
  };

  const config = useMemo<VisualConfig>(
    () => ({
      scene,
      mode,
      modeBlend,
      colorPreset,
      colorDrive,
      fishCount,
      fishSize,
      speed,
      depth,
      bpm,
      dive,
      selectedSpecies,
      swimType,
      swarm,
      performance: performanceState,
      fx,
    }),
    [
      scene,
      mode,
      modeBlend,
      colorPreset,
      colorDrive,
      fishCount,
      fishSize,
      speed,
      depth,
      bpm,
      dive,
      selectedSpecies,
      swimType,
      swarm,
      performanceState,
      fx,
    ],
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("fishvj-cues-v2");
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length !== DEFAULT_CUES.length) return;
      setCues(parsed.map((cue, index) => sanitizeCue(cue, DEFAULT_CUES[index])));
    } catch {
      window.localStorage.removeItem("fishvj-cues-v2");
    }
  }, []);

  useEffect(
    () => () => cancelAnimationFrame(cueTransitionFrameRef.current),
    [],
  );

  const stopAudio = useCallback(() => {
    const runtime = audioRuntimeRef.current;
    if (!runtime) return;
    cancelAnimationFrame(runtime.frame);
    runtime.stream?.getTracks().forEach((track) => track.stop());
    if (runtime.audio) {
      runtime.audio.pause();
      if (runtime.audio.src.startsWith("blob:")) URL.revokeObjectURL(runtime.audio.src);
    }
    void runtime.context.close();
    audioRuntimeRef.current = null;
  }, []);

  const runAnalyser = useCallback((runtime: AudioRuntime) => {
    const bins = new Uint8Array(runtime.analyser.frequencyBinCount);
    let smoothed = { ...EMPTY_LEVELS };
    let lastUiUpdate = 0;

    const analyse = (now: number) => {
      runtime.analyser.getByteFrequencyData(bins);
      const next = {
        kick: averageBand(bins, runtime.context.sampleRate, runtime.analyser.fftSize, 30, 100),
        bass: averageBand(bins, runtime.context.sampleRate, runtime.analyser.fftSize, 100, 250),
        mid: averageBand(bins, runtime.context.sampleRate, runtime.analyser.fftSize, 250, 2000),
        high: averageBand(bins, runtime.context.sampleRate, runtime.analyser.fftSize, 2000, 12000),
      };
      smoothed = {
        kick: smoothed.kick * 0.7 + next.kick * 0.3,
        bass: smoothed.bass * 0.75 + next.bass * 0.25,
        mid: smoothed.mid * 0.78 + next.mid * 0.22,
        high: smoothed.high * 0.74 + next.high * 0.26,
      };
      if (now - lastUiUpdate > 45) {
        setAudioLevels(smoothed);
        lastUiUpdate = now;
      }
      runtime.frame = requestAnimationFrame(analyse);
    };
    runtime.frame = requestAnimationFrame(analyse);
  }, []);

  const startMic = useCallback(
    async (deviceId?: string) => {
      stopAudio();
      setAudioStatus("REQUESTING MIC");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        const context = new AudioContext();
        await context.resume();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.38;
        source.connect(analyser);
        const runtime: AudioRuntime = {
          context,
          source,
          analyser,
          stream,
          frame: 0,
        };
        audioRuntimeRef.current = runtime;
        runAnalyser(runtime);
        const devices = await navigator.mediaDevices.enumerateDevices();
        const microphones = devices.filter((device) => device.kind === "audioinput");
        setMicDevices(microphones);
        const active = stream.getAudioTracks()[0]?.getSettings().deviceId;
        setAudioInput(active || "mic");
        setAudioStatus("MIC LIVE");
      } catch {
        setAudioInput("demo");
        setAudioStatus("MIC UNAVAILABLE");
      }
    },
    [runAnalyser, stopAudio],
  );

  const startAudioFile = useCallback(
    async (file: File) => {
      stopAudio();
      const context = new AudioContext();
      const audio = new Audio(URL.createObjectURL(file));
      audio.loop = true;
      const source = context.createMediaElementSource(audio);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyser.connect(context.destination);
      const runtime: AudioRuntime = {
        context,
        source,
        analyser,
        audio,
        frame: 0,
      };
      audioRuntimeRef.current = runtime;
      await context.resume();
      await audio.play();
      runAnalyser(runtime);
      setAudioStatus(file.name.toUpperCase().slice(0, 22));
      setAudioInput("file");
    },
    [runAnalyser, stopAudio],
  );

  useEffect(() => {
    const updateDemo = (now: number) => {
      if (audioInput === "demo") {
        const beatMs = 60000 / bpm;
        const beat = ((now - beatStartRef.current) % beatMs) / beatMs;
        const kick = Math.exp(-beat * 11);
        const offbeat = ((beat + 0.5) % 1);
        const hat = Math.exp(-offbeat * 22) * 0.72;
        setAudioLevels({
          kick,
          bass: 0.24 + kick * 0.58,
          mid: 0.2 + 0.14 * (0.5 + 0.5 * Math.sin(now * 0.0018)),
          high: 0.12 + hat,
        });
      }
      demoFrameRef.current = requestAnimationFrame(updateDemo);
    };
    demoFrameRef.current = requestAnimationFrame(updateDemo);
    return () => cancelAnimationFrame(demoFrameRef.current);
  }, [audioInput, bpm]);

  useEffect(() => stopAudio, [stopAudio]);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  const triggerPerformance = useCallback((pad: OneShotPad) => {
    const field = PAD_FIELD[pad];
    setPerformanceState((current) => ({
      ...current,
      [field]: performance.now(),
    }));
    setActivePads((current) => ({ ...current, [pad]: true }));
    if (padTimersRef.current[pad]) clearTimeout(padTimersRef.current[pad]);
    padTimersRef.current[pad] = setTimeout(() => {
      setActivePads((current) => ({ ...current, [pad]: false }));
      delete padTimersRef.current[pad];
    }, PAD_DURATION[pad]);
  }, []);

  const setSlowMo = useCallback((active: boolean) => {
    setPerformanceState((current) =>
      current.slowMo === active ? current : { ...current, slowMo: active },
    );
  }, []);

  const clearPerformance = useCallback(() => {
    Object.values(padTimersRef.current).forEach((timer) => clearTimeout(timer));
    padTimersRef.current = {};
    setPerformanceState(INITIAL_PERFORMANCE);
    setActivePads(INITIAL_ACTIVE_PADS);
    setHoldBlackout(false);
  }, []);

  const releaseFaders = useCallback(() => {
    heldFaderKeysRef.current.clear();
    fxDirectionRef.current = 0;
    setFxAdjusting(0);
    setHeldFaderKeys([]);
  }, []);

  const recallCue = useCallback((index: number) => {
    const target = cuesRef.current[index];
    if (!target) return;
    cancelAnimationFrame(cueTransitionFrameRef.current);
    const from = liveSnapshotRef.current;
    const startedAt = performance.now();
    const duration = cueMorphTime * 1000;

    setActiveCue(index);
    setCueStatus(`MORPHING → F${index + 1} ${target.name}`);
    setScene(target.scene);
    setColorPreset(target.colorPreset);
    setSwimType(target.swimType);
    setSwarm(target.swarm);
    setDive(false);

    const animate = (now: number) => {
      const progress = clamp((now - startedAt) / duration, 0, 1);
      const eased = progress * progress * (3 - 2 * progress);
      const mix = (start: number, end: number) => start + (end - start) * eased;

      setModeBlend(mix(from.modeBlend, target.modeBlend));
      setColorDrive(mix(from.colorDrive, target.colorDrive));
      setFishSize(mix(from.fishSize, target.fishSize));
      setSpeed(mix(from.speed, target.speed));
      setDepth(mix(from.depth, target.depth));
      setFx(Object.fromEntries(
        FX_DEFS.map(({ id }) => [id, mix(from.fx[id], target.fx[id])]),
      ) as FxState);

      if (progress < 1) {
        cueTransitionFrameRef.current = requestAnimationFrame(animate);
      } else {
        setCueStatus(`LIVE · F${index + 1} ${target.name}`);
      }
    };

    cueTransitionFrameRef.current = requestAnimationFrame(animate);
  }, [cueMorphTime]);

  useEffect(() => {
    recallCueRef.current = recallCue;
  }, [recallCue]);

  const saveCue = useCallback((index: number) => {
    cancelAnimationFrame(cueTransitionFrameRef.current);
    const current = liveSnapshotRef.current;
    const saved: CuePreset = {
      ...current,
      name: cuesRef.current[index]?.name ?? `CUE ${index + 1}`,
      fx: { ...current.fx },
    };
    const next = cuesRef.current.map((cue, cueIndex) =>
      cueIndex === index ? saved : cue
    );
    cuesRef.current = next;
    setCues(next);
    setActiveCue(index);
    setCueStatus(`SAVED · F${index + 1} ${saved.name}`);
    window.localStorage.setItem("fishvj-cues-v2", JSON.stringify(next));
  }, []);

  useEffect(() => {
    if (!autoPilot) return;
    const interval = window.setTimeout(() => {
      recallCueRef.current((activeCue + 1) % DEFAULT_CUES.length);
    }, (60000 / bpm) * autoBeats);
    return () => window.clearTimeout(interval);
  }, [activeCue, autoBeats, autoPilot, bpm]);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();

    const animateFaders = (now: number) => {
      const delta = Math.min(0.05, Math.max(0, (now - previous) / 1000));
      previous = now;
      const keys = heldFaderKeysRef.current;
      const axis = (decrease: string, increase: string) =>
        Number(keys.has(increase)) - Number(keys.has(decrease));

      const modeAxis = axis("z", "x");
      const colorAxis = axis("c", "v");
      const speedAxis = axis("ArrowDown", "ArrowUp");
      const depthAxis = axis("ArrowLeft", "ArrowRight");
      const sizeAxis = axis("[", "]");

      if (modeAxis) {
        setModeBlend((value) => clamp(value + modeAxis * delta * 0.62, 0, 2));
      }
      if (colorAxis) {
        setColorDrive((value) => clamp(value + colorAxis * delta * 0.5, 0, 1));
      }
      if (speedAxis) {
        setSpeed((value) => clamp(value + speedAxis * delta * 0.56, 0.2, 1.6));
      }
      if (depthAxis) {
        setDepth((value) => clamp(value + depthAxis * delta * 0.4, 0.15, 1));
      }
      if (sizeAxis) {
        setFishSize((value) => clamp(value + sizeAxis * delta * 0.9, 0.5, 3));
      }
      if (fxDirectionRef.current) {
        const fxId = selectedFxRef.current;
        setFx((current) => ({
          ...current,
          [fxId]: clamp(
            current[fxId] + fxDirectionRef.current * delta * 0.62,
            0,
            1,
          ),
        }));
      }

      frame = requestAnimationFrame(animateFaders);
    };

    frame = requestAnimationFrame(animateFaders);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(
    () => () => {
      Object.values(padTimersRef.current).forEach((timer) => clearTimeout(timer));
    },
    [],
  );

  const reset = useCallback(() => {
    cancelAnimationFrame(cueTransitionFrameRef.current);
    clearPerformance();
    releaseFaders();
    spaceLayerRef.current = false;
    setSpaceLayer(false);
    setFxAdjusting(0);
    setScene("MANDALA");
    setModeBlend(0);
    setColorPreset("PUNCH");
    setColorDrive(0.72);
    setFishCount(800);
    setFishSize(1.5);
    setSpeed(0.68);
    setDepth(0.74);
    setDive(false);
    setBlackout(false);
    setSelectedSpecies([0]);
    setSwimType("SCHOOL");
    setSwarm("SPIRAL");
    setFx(INITIAL_FX);
    setControlView("CORE");
    setSelectedFx("feedback");
    setActiveCue(0);
    setAutoPilot(false);
    setCueStatus("INTRO SAFE · ALL FX CLEAR");
  }, [clearPerformance, releaseFaders]);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await outputRef.current?.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        reset();
        return;
      }
      if (event.key === "Shift") {
        if (!event.repeat) setSlowMo(true);
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        if (!event.repeat) setHoldBlackout(true);
        return;
      }
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.code === "Space") {
        event.preventDefault();
        spaceLayerRef.current = true;
        setSpaceLayer(true);
        return;
      }
      const cueMatch = /^F([1-8])$/.exec(event.key);
      if (cueMatch) {
        event.preventDefault();
        if (event.repeat) return;
        const cueIndex = Number(cueMatch[1]) - 1;
        if (event.shiftKey) saveCue(cueIndex);
        else recallCue(cueIndex);
        setControlView("CUES");
        return;
      }
      if (spaceLayerRef.current) {
        if (/^[1-8]$/.test(event.key)) {
          event.preventDefault();
          const fxIndex = Number(event.key) - 1;
          const fxId = FX_DEFS[fxIndex].id;
          selectedFxRef.current = fxId;
          setSelectedFx(fxId);
          setControlView("FX");
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          const direction = event.key === "ArrowLeft" ? -1 : 1;
          fxDirectionRef.current = direction;
          setFxAdjusting(direction);
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const fxId = selectedFxRef.current;
          const value = event.key === "ArrowDown" ? 0 : 1;
          setFx((current) => ({ ...current, [fxId]: value }));
          return;
        }
      }
      const faderKey = normalizeFaderKey(event.key);
      if (faderKey) {
        event.preventDefault();
        if (!heldFaderKeysRef.current.has(faderKey)) {
          heldFaderKeysRef.current.add(faderKey);
          setHeldFaderKeys(Array.from(heldFaderKeysRef.current));
        }
        return;
      }
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "t") triggerPerformance("strobe");
      if (key === "g") triggerPerformance("rush");
      if (key === "h") triggerPerformance("scatter");
      if (key === "j") triggerPerformance("hueFlip");
      if (key === "k") triggerPerformance("kaleidoBurst");
      if (key === "p") {
        setAutoPilot((value) => !value);
        setControlView("CUES");
      }
      if (key === "o") {
        setAutoBeats((value) => value === 4 ? 8 : value === 8 ? 16 : 4);
        setControlView("CUES");
      }
      if (event.key === "1") setModeBlend(0);
      if (event.key === "2") setModeBlend(1);
      if (event.key === "3") setModeBlend(2);
      if (event.key === "0") {
        setScene((value) => {
          const next = value === "MANDALA" ? "FREE_SWIM" : "MANDALA";
          if (next === "FREE_SWIM") setDive(false);
          return next;
        });
      }
      if (key === "d" && scene === "MANDALA") setDive((value) => !value);
      if (key === "b") setBlackout((value) => !value);
      if (key === "f") void toggleFullscreen();
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        spaceLayerRef.current = false;
        fxDirectionRef.current = 0;
        setSpaceLayer(false);
        setFxAdjusting(0);
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        fxDirectionRef.current = 0;
        setFxAdjusting(0);
      }
      const faderKey = normalizeFaderKey(event.key);
      if (faderKey) {
        event.preventDefault();
        heldFaderKeysRef.current.delete(faderKey);
        setHeldFaderKeys(Array.from(heldFaderKeysRef.current));
      }
      if (event.key === "Shift") setSlowMo(false);
      if (event.key === "Tab") {
        event.preventDefault();
        setHoldBlackout(false);
      }
    };
    const releaseHolds = () => {
      setSlowMo(false);
      setHoldBlackout(false);
      spaceLayerRef.current = false;
      setSpaceLayer(false);
      releaseFaders();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseHolds);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseHolds);
    };
  }, [
    recallCue,
    releaseFaders,
    reset,
    saveCue,
    scene,
    setSlowMo,
    toggleFullscreen,
    triggerPerformance,
  ]);

  const toggleSpecies = useCallback((index: number, motion: SwimType) => {
    setSelectedSpecies((current) => {
      if (current.includes(index)) {
        return current.length === 1 ? current : current.filter((item) => item !== index);
      }
      return [...current, index].sort((a, b) => a - b);
    });
    setSwimType(motion);
  }, []);

  const handleAudioInput = async (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === "demo") {
      stopAudio();
      setAudioInput("demo");
      setAudioStatus("DEMO PULSE");
      return;
    }
    if (value === "file") {
      fileRef.current?.click();
      return;
    }
    await startMic(value === "mic" ? undefined : value);
  };

  const micLevel = Math.min(
    100,
    Math.round((audioLevels.kick * 0.34 + audioLevels.mid * 0.28 + audioLevels.high * 0.38) * 118),
  );
  const activeFxCount = FX_DEFS.filter(({ id }) => fx[id] > 0.015).length;
  const keyboardFaders: Array<{
    id: KeyboardFader;
    keys: string[];
    label: string;
    value: string;
    level: number;
    active: boolean;
  }> = [
    {
      id: "mode",
      keys: ["Z", "X"],
      label: "MODE MORPH",
      value: `${Math.round(modeBlend * 50)}%`,
      level: modeBlend / 2,
      active: heldFaderKeys.includes("z") || heldFaderKeys.includes("x"),
    },
    {
      id: "color",
      keys: ["C", "V"],
      label: "COLOR",
      value: `${Math.round(colorDrive * 100)}%`,
      level: colorDrive,
      active: heldFaderKeys.includes("c") || heldFaderKeys.includes("v"),
    },
    {
      id: "speed",
      keys: ["↓", "↑"],
      label: "SPEED",
      value: `${Math.round(speed * 100)}`,
      level: (speed - 0.2) / 1.4,
      active: heldFaderKeys.includes("ArrowDown") || heldFaderKeys.includes("ArrowUp"),
    },
    {
      id: "depth",
      keys: ["←", "→"],
      label: "DEPTH",
      value: `${Math.round(depth * 100)}`,
      level: (depth - 0.15) / 0.85,
      active: heldFaderKeys.includes("ArrowLeft") || heldFaderKeys.includes("ArrowRight"),
    },
    {
      id: "size",
      keys: ["[", "]"],
      label: "SIZE",
      value: `${fishSize.toFixed(1)}x`,
      level: (fishSize - 0.5) / 2.5,
      active: heldFaderKeys.includes("[") || heldFaderKeys.includes("]"),
    },
  ];

  return (
    <main className={`vj-shell ${blackout || holdBlackout ? "is-blackout" : ""}`}>
      <header className="topbar">
        <div className="brand" aria-label="FishVJ">
          FISH<span>VJ</span>
        </div>
        <div className="live-status">
          <i />
          <strong>LIVE</strong>
          <span>{fps} FPS</span>
        </div>
        <button className="outline-button preview-button" onClick={toggleFullscreen}>
          OUTPUT VIEW
        </button>
      </header>

      <aside className="fish-deck panel" aria-label="Fish deck">
        <h2>
          FISH DECK <span>{selectedSpecies.length} SELECTED</span>
        </h2>
        <div className="fish-grid">
          {FISH.map((fish, index) => (
            <button
              key={fish.name}
              className={`fish-card ${selectedSpecies.includes(index) ? "is-active" : ""}`}
              style={
                {
                  "--fish-x": `${(index % 4) * 33.333}%`,
                  "--fish-y": `${Math.floor(index / 4) * 100}%`,
                } as React.CSSProperties
              }
              onClick={() => toggleSpecies(index, fish.motion)}
              aria-pressed={selectedSpecies.includes(index)}
              aria-label={`${fish.name}, ${fish.motion} movement`}
            >
              <span>{index + 1}</span>
              <i />
              <small>{fish.name}</small>
            </button>
          ))}
        </div>
        <div className="swim-buttons" role="group" aria-label="Movement type">
          {SWIMS.map((swim) => (
            <button
              key={swim}
              className={swimType === swim ? "is-active" : ""}
              onClick={() => setSwimType(swim)}
              aria-pressed={swimType === swim}
            >
              <span aria-hidden>{swim === "SCHOOL" ? "≋" : swim === "GLIDE" ? "⟶" : swim === "WAVE" ? "〰" : "⠿"}</span>
              {swim}
            </button>
          ))}
        </div>
        <p className="shortcut-note">
          <span>0 SCENE · 1–3 MODE · D DIVE · B LOCK · F OUTPUT</span>
          <span>T STROBE · G RUSH · H SCATTER · J HUE · K KALEIDO</span>
          <span>Z/X MODE · C/V COLOR · ↑↓ SPEED · ←→ DEPTH · [ ] SIZE</span>
          <span>SPACE+1–8 FX · SPACE+←→ LEVEL · F1–F8 CUE · P AUTO</span>
          <span>HOLD TO FADE · ⇧ SLOW · TAB BLACK · ESC INTRO</span>
        </p>
      </aside>

      <section className="output-column">
        <div
          className={`live-output ${dive ? "is-diving" : ""} ${isFullscreen ? "is-fullscreen" : ""}`}
          ref={outputRef}
        >
          <FishCanvas config={config} audio={audioLevels} onFps={setFps} />
          <div className="scanlines" aria-hidden />
          <div className="output-badges">
            <span>
              {scene === "MANDALA"
                ? `CH 01 · MANDALA · ${mode} · ${swarm} · K-${kaleidoSegments.toFixed(1)}`
                : `CH 01 · FREE SWIM · ${mode} · ${FREE_SWIM_STYLES[swarm]}`}
            </span>
            <span>
              {fishCount.toLocaleString()} FISH · FX {activeFxCount}
              {autoPilot ? ` · AUTO ${autoBeats}` : ""}
            </span>
          </div>
          {dive && (
            <div className="dive-badge">
              <b>{scene === "MANDALA" ? "∞" : "≋"}</b>
              <span>{scene === "MANDALA" ? "INFINITE DIVE" : "SCHOOL RUSH"}</span>
            </div>
          )}
          <div className="blackout-screen">
            <span>BLACKOUT</span>
          </div>
        </div>
        <section className="perform-panel" aria-label="Performance pads">
          <div className="perform-heading">
            <strong>PERFORM</strong>
            <small>ONE-SHOT + HOLD</small>
          </div>
          <div className="perform-grid">
            {ONE_SHOT_PADS.map((pad) => (
              <button
                key={pad.id}
                data-pad={pad.id}
                className={activePads[pad.id] ? "is-active" : ""}
                onClick={() => triggerPerformance(pad.id)}
                aria-pressed={activePads[pad.id]}
                aria-label={`${pad.label}, ${pad.keyLabel} key`}
              >
                <kbd>{pad.keyLabel}</kbd>
                <b>{pad.symbol}</b>
                <span>{pad.label}</span>
              </button>
            ))}
            <button
              data-pad="slowMo"
              className={performanceState.slowMo ? "is-active" : ""}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setSlowMo(true);
              }}
              onPointerUp={() => setSlowMo(false)}
              onPointerCancel={() => setSlowMo(false)}
              onLostPointerCapture={() => setSlowMo(false)}
              aria-pressed={performanceState.slowMo}
              aria-label="SLOW-MO, hold Shift"
            >
              <kbd>⇧</kbd>
              <b>◌</b>
              <span>SLOW-MO</span>
            </button>
            <button
              data-pad="holdBlackout"
              className={holdBlackout ? "is-active" : ""}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setHoldBlackout(true);
              }}
              onPointerUp={() => setHoldBlackout(false)}
              onPointerCancel={() => setHoldBlackout(false)}
              onLostPointerCapture={() => setHoldBlackout(false)}
              aria-pressed={holdBlackout}
              aria-label="BLACKOUT, hold Tab"
            >
              <kbd>TAB</kbd>
              <b>●</b>
              <span>BLACKOUT</span>
            </button>
          </div>
          <div className="keyboard-faders" role="group" aria-label="Keyboard gradient controls">
            {keyboardFaders.map((fader) => (
              <div
                key={fader.id}
                className={`keyboard-fader ${fader.active ? "is-active" : ""}`}
                data-fader={fader.id}
                style={{ "--level": `${clamp(fader.level, 0, 1) * 100}%` } as React.CSSProperties}
              >
                <span className="fader-keys" aria-hidden>
                  {fader.keys.map((key) => <kbd key={key}>{key}</kbd>)}
                </span>
                <strong>{fader.label}</strong>
                <i><b /></i>
                <output>{fader.value}</output>
              </div>
            ))}
          </div>
        </section>
      </section>

      <aside className="control-panel panel" aria-label="Live controls">
        <div className="control-tabs" role="tablist" aria-label="Control view">
          {(["CORE", "FX", "CUES"] as ControlView[]).map((view) => (
            <button
              key={view}
              role="tab"
              className={controlView === view ? "is-active" : ""}
              aria-selected={controlView === view}
              onClick={() => setControlView(view)}
            >
              {view}
              {view === "FX" && <small>{activeFxCount}</small>}
              {view === "CUES" && autoPilot && <small className="is-live">●</small>}
            </button>
          ))}
        </div>
        <div className={`control-view control-view-${controlView.toLowerCase()}`}>
        {controlView === "CORE" && (
          <>
        <section className="scene-section">
          <h2>SCENE</h2>
          <div className="scene-buttons" role="group" aria-label="Scene mode">
            {SCENES.map((item) => (
              <button
                key={item.id}
                className={scene === item.id ? "is-active" : ""}
                onClick={() => {
                  setScene(item.id);
                  if (item.id === "FREE_SWIM") setDive(false);
                }}
                aria-pressed={scene === item.id}
              >
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>MODE</h2>
          <div className="mode-buttons">
            {MODES.map((item, index) => (
              <button
                key={item}
                className={mode === item ? "is-active" : ""}
                onClick={() => setModeBlend(index)}
                aria-pressed={mode === item}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>COLOR</h2>
          <div className="color-buttons">
            {COLORS.map((color) => (
              <button
                key={color}
                data-color={color}
                className={colorPreset === color ? "is-active" : ""}
                onClick={() => setColorPreset(color)}
                aria-pressed={colorPreset === color}
              >
                {color}
              </button>
            ))}
          </div>
          <RangeControl
            label="COLOR DRIVE"
            value={colorDrive}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round(colorDrive * 100)}%`}
            onChange={setColorDrive}
          />
        </section>

        <section className="motion-section">
          <h2>MOTION</h2>
          <div className="swarm-control">
            <h3>{scene === "MANDALA" ? "SWARM" : "SWIM STYLE"}</h3>
            <div
              className="swarm-buttons"
              role="group"
              aria-label={scene === "MANDALA" ? "Swarm structure" : "Free swim style"}
            >
              {SWARMS.map((item) => (
                <button
                  key={item}
                  className={swarm === item ? "is-active" : ""}
                  onClick={() => setSwarm(item)}
                  aria-pressed={swarm === item}
                >
                  {scene === "MANDALA" ? item : FREE_SWIM_STYLES[item]}
                </button>
              ))}
            </div>
          </div>
          <RangeControl
            label="FISH COUNT"
            value={fishCount}
            min={100}
            max={2000}
            step={50}
            display={fishCount.toLocaleString()}
            onChange={setFishCount}
          />
          <RangeControl
            label="FISH SIZE"
            value={fishSize}
            min={0.5}
            max={3}
            step={0.05}
            display={`${fishSize.toFixed(1)}x`}
            onChange={setFishSize}
          />
          <RangeControl
            label="SPEED"
            value={speed}
            min={0.2}
            max={1.6}
            step={0.01}
            display={`${Math.round(speed * 100)}`}
            onChange={setSpeed}
          />
          <RangeControl
            label="DEPTH"
            value={depth}
            min={0.15}
            max={1}
            step={0.01}
            display={`${Math.round(depth * 100)}`}
            onChange={setDepth}
          />
        </section>

        <div className="dive-controls">
          <button
            className={`dive-button ${scene === "MANDALA" ? (dive ? "is-active" : "") : (activePads.rush ? "is-active" : "")}`}
            onClick={() => scene === "MANDALA" ? setDive(true) : triggerPerformance("rush")}
            aria-pressed={scene === "MANDALA" ? dive : activePads.rush}
          >
            <b>{scene === "MANDALA" ? "∞" : "≋"}</b>
            <span>{scene === "MANDALA" ? "INFINITE DIVE" : "SCHOOL RUSH"}</span>
          </button>
          <button
            className="exit-button"
            onClick={() => setDive(false)}
            disabled={scene === "FREE_SWIM" || !dive}
          >
            {scene === "MANDALA" ? "EXIT DIVE" : "ONE SHOT · G"}
          </button>
        </div>
          </>
        )}

        {controlView === "FX" && (
          <section className="fx-rack" aria-label="FX Rack">
            <div className="rack-heading">
              <div>
                <h2>FX RACK</h2>
                <small>{spaceLayer ? "SPACE LAYER ACTIVE" : "SPACE + 1–8 SELECT"}</small>
              </div>
              <button
                className="rack-clear"
                onClick={() => setFx(INITIAL_FX)}
              >
                CLEAR ALL
              </button>
            </div>
            <div className="fx-controls">
              {FX_DEFS.map((item, index) => (
                <label
                  key={item.id}
                  className={`fx-control ${selectedFx === item.id ? "is-selected" : ""} ${
                    selectedFx === item.id && fxAdjusting ? "is-adjusting" : ""
                  }`}
                  onPointerDown={() => {
                    selectedFxRef.current = item.id;
                    setSelectedFx(item.id);
                  }}
                >
                  <span className="fx-control-head">
                    <kbd>{index + 1}</kbd>
                    <b>{item.symbol}</b>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.hint}</small>
                    </span>
                    <output>{Math.round(fx[item.id] * 100)}%</output>
                  </span>
                  <input
                    aria-label={item.label}
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={fx[item.id]}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setFx((current) => ({ ...current, [item.id]: value }));
                    }}
                  />
                </label>
              ))}
            </div>
            <p className="rack-help">
              <span>SPACE + 1–8 SELECT FX</span>
              <span>SPACE + ← → FADE · ↓ 0% · ↑ 100%</span>
            </p>
          </section>
        )}

        {controlView === "CUES" && (
          <section className="cue-bank" aria-label="Cue Bank">
            <div className="rack-heading">
              <div>
                <h2>CUE BANK</h2>
                <small>{cueStatus}</small>
              </div>
              <button
                className={`auto-button ${autoPilot ? "is-active" : ""}`}
                onClick={() => setAutoPilot((value) => !value)}
                aria-pressed={autoPilot}
              >
                {autoPilot ? "● AUTO ON" : "AUTO OFF"}
              </button>
            </div>
            <div className="cue-grid">
              {cues.map((cue, index) => (
                <button
                  key={`${index}-${cue.name}`}
                  className={activeCue === index ? "is-active" : ""}
                  onClick={(event) => {
                    if (event.shiftKey) saveCue(index);
                    else recallCue(index);
                  }}
                  aria-label={`F${index + 1} ${cue.name}`}
                >
                  <kbd>F{index + 1}</kbd>
                  <strong>{cue.name}</strong>
                  <small>
                    {cue.scene === "MANDALA" ? "MANDALA" : "FREE"} · FX{" "}
                    {FX_DEFS.filter(({ id }) => cue.fx[id] > 0.015).length}
                  </small>
                </button>
              ))}
            </div>
            <RangeControl
              label="MORPH TIME"
              value={cueMorphTime}
              min={0.5}
              max={8}
              step={0.1}
              display={`${cueMorphTime.toFixed(1)}s`}
              onChange={setCueMorphTime}
            />
            <div className="auto-controls">
              <div>
                <span>AUTO PILOT</span>
                <strong>{autoPilot ? "RUNNING" : "STANDBY"}</strong>
              </div>
              <div className="beat-length" role="group" aria-label="Auto pilot beat length">
                {([4, 8, 16] as const).map((beats) => (
                  <button
                    key={beats}
                    className={autoBeats === beats ? "is-active" : ""}
                    onClick={() => setAutoBeats(beats)}
                    aria-pressed={autoBeats === beats}
                  >
                    {beats} BEAT
                  </button>
                ))}
              </div>
            </div>
            <p className="cue-help">
              F1–F8 RECALL · SHIFT + F1–F8 SAVE<br />
              P AUTO ON/OFF · O BEAT LENGTH
            </p>
          </section>
        )}
        </div>
      </aside>

      <footer className="audio-bar">
        <section className="audio-source">
          <label htmlFor="audio-input">AUDIO INPUT</label>
          <select id="audio-input" value={audioInput} onChange={handleAudioInput}>
            <option value="demo">DEMO PULSE</option>
            <option value="mic">MICROPHONE</option>
            {micDevices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `MIC ${index + 1}`}
              </option>
            ))}
            <option value="file">AUDIO FILE…</option>
          </select>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void startAudioFile(file);
            }}
          />
          <small>{audioStatus}</small>
        </section>

        <section className="mic-meter">
          <div>
            <strong>MIC</strong>
            <span>{micLevel}%</span>
          </div>
          <div className="meter-track">
            <i style={{ width: `${micLevel}%` }} />
          </div>
        </section>

        <section className="bpm-display">
          <span>BPM</span>
          <strong>{bpm}</strong>
          <i
            className="beat-orb"
            style={{ "--beat": audioLevels.kick } as React.CSSProperties}
          />
        </section>

        <section className="safety-controls">
          <button
            className={blackout ? "is-active danger" : ""}
            onClick={() => setBlackout((value) => !value)}
            aria-pressed={blackout}
          >
            ◉ BLACKOUT
          </button>
          <button onClick={reset}>↻ RESET</button>
          <button onClick={toggleFullscreen}>⛶ FULLSCREEN</button>
        </section>
      </footer>
    </main>
  );
}
