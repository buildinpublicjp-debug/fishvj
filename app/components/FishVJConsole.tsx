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
  const [mode, setMode] = useState<ModeName>("MYSTIC");
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
  const outputRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRuntimeRef = useRef<AudioRuntime | null>(null);
  const demoFrameRef = useRef(0);
  const beatStartRef = useRef(performance.now());
  const padTimersRef = useRef<Partial<Record<OneShotPad, ReturnType<typeof setTimeout>>>>({});

  const config = useMemo<VisualConfig>(
    () => ({
      scene,
      mode,
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
    }),
    [
      scene,
      mode,
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
    ],
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

  useEffect(
    () => () => {
      Object.values(padTimersRef.current).forEach((timer) => clearTimeout(timer));
    },
    [],
  );

  const reset = useCallback(() => {
    clearPerformance();
    setScene("MANDALA");
    setMode("MYSTIC");
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
  }, [clearPerformance]);

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
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "t") triggerPerformance("strobe");
      if (key === "g") triggerPerformance("rush");
      if (key === "h") triggerPerformance("scatter");
      if (key === "j") triggerPerformance("hueFlip");
      if (key === "k") triggerPerformance("kaleidoBurst");
      if (event.key === "1") setMode("MYSTIC");
      if (event.key === "2") setMode("SENSUAL");
      if (event.key === "3") setMode("EUPHORIC");
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
      if (event.key === "Shift") setSlowMo(false);
      if (event.key === "Tab") {
        event.preventDefault();
        setHoldBlackout(false);
      }
    };
    const releaseHolds = () => {
      setSlowMo(false);
      setHoldBlackout(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseHolds);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseHolds);
    };
  }, [reset, scene, setSlowMo, toggleFullscreen, triggerPerformance]);

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
          <span>⇧ SLOW-MO · TAB BLACKOUT · ESC INTRO</span>
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
                ? `CH 01 · MANDALA · ${mode} · ${swarm} · K-${mode === "MYSTIC" ? "06" : mode === "SENSUAL" ? "08" : "12"}`
                : `CH 01 · FREE SWIM · ${mode} · ${FREE_SWIM_STYLES[swarm]}`}
            </span>
            <span>{fishCount.toLocaleString()} FISH</span>
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
        </section>
      </section>

      <aside className="control-panel panel" aria-label="Live controls">
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
            {MODES.map((item) => (
              <button
                key={item}
                className={mode === item ? "is-active" : ""}
                onClick={() => setMode(item)}
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
