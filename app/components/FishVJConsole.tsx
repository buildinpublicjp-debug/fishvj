"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  engine,
  isCaptureEnabled,
  ParamEventCoalescer,
  type EngineEventInput,
} from "../engine";
import type {
  AudioLevels,
  ColorPreset,
  ModeName,
  SceneMode,
  SwarmType,
  SwimType,
} from "../engine";
import { FishCanvas } from "./FishCanvas";

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
  const engineState = useSyncExternalStore(
    engine.subscribe,
    engine.getState,
    engine.getState,
  );
  const {
    scene,
    mode,
    colorPreset,
    colorDrive,
    fishCount,
    fishSize,
    speed,
    depth,
    dive,
    blackout,
    selectedSpecies,
    swimType,
    swarm,
  } = engineState;
  const [fps, setFps] = useState(60);
  const [audioLevels, setAudioLevels] = useState<AudioLevels>(EMPTY_LEVELS);
  const [audioInput, setAudioInput] = useState("demo");
  const [audioStatus, setAudioStatus] = useState("DEMO PULSE");
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [bpm] = useState(138);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRuntimeRef = useRef<AudioRuntime | null>(null);
  const demoFrameRef = useRef(0);
  const beatStartRef = useRef<number | null>(null);

  const dispatch = useCallback((input: EngineEventInput) => engine.dispatch(input), []);
  const continuousParamsRef = useRef<ParamEventCoalescer | null>(null);
  continuousParamsRef.current ??= new ParamEventCoalescer((payload, sourceT) => {
    dispatch({ v: 1, producerId: "ui", sourceT, type: "param", payload });
  });
  const dispatchContinuous = useCallback(
    (payload: Parameters<ParamEventCoalescer["push"]>[0]) => {
      continuousParamsRef.current?.push(payload);
    },
    [],
  );

  useEffect(() => () => continuousParamsRef.current?.dispose(), []);

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
    // Deterministic capture runs with every audio band pinned to 0.
    if (isCaptureEnabled()) return;
    const updateDemo = (now: number) => {
      if (audioInput === "demo") {
        beatStartRef.current ??= now;
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

  const reset = useCallback(() => {
    dispatch({
      v: 1,
      producerId: "ui",
      type: "oneshot",
      payload: { id: "reset", update: "trigger" },
    });
  }, [dispatch]);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await outputRef.current?.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        return;
      }
      if (event.repeat) return;
      if (event.key === "1" || event.key === "2" || event.key === "3") {
        const value = event.key === "1" ? "MYSTIC" : event.key === "2" ? "SENSUAL" : "EUPHORIC";
        dispatch({
          v: 1,
          producerId: "keys",
          type: "mode",
          payload: { update: "absolute", value },
        });
      }
      if (event.key === "0") {
        const value = engine.getState().scene === "MANDALA" ? "FREE_SWIM" : "MANDALA";
        dispatch({
          v: 1,
          producerId: "keys",
          type: "scene",
          payload: { update: "absolute", value },
        });
      }
      if (event.key.toLowerCase() === "d") {
        dispatch({
          v: 1,
          producerId: "keys",
          type: "param",
          payload: { id: "dive", update: "absolute", value: !engine.getState().dive },
        });
      }
      if (event.key.toLowerCase() === "b") {
        dispatch({
          v: 1,
          producerId: "keys",
          type: "param",
          payload: { id: "blackout", update: "absolute", value: !engine.getState().blackout },
        });
      }
      if (event.key.toLowerCase() === "f") void toggleFullscreen();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [dispatch, toggleFullscreen]);

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
    <main className={`vj-shell ${blackout ? "is-blackout" : ""}`}>
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
        <h2>FISH DECK</h2>
        <div className="fish-grid">
          {FISH.map((fish, index) => (
            <button
              key={fish.name}
              className={`fish-card ${selectedSpecies === index ? "is-active" : ""}`}
              style={
                {
                  "--fish-x": `${(index % 4) * 33.333}%`,
                  "--fish-y": `${Math.floor(index / 4) * 100}%`,
                } as React.CSSProperties
              }
              onClick={() => {
                dispatch({
                  v: 1,
                  producerId: "ui",
                  type: "param",
                  payload: {
                    id: "fishSelection",
                    update: "atomic",
                    selectedSpecies: index,
                    swimType: fish.motion,
                  },
                });
              }}
              aria-pressed={selectedSpecies === index}
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
              onClick={() =>
                dispatch({
                  v: 1,
                  producerId: "ui",
                  type: "param",
                  payload: { id: "swimType", update: "absolute", value: swim },
                })
              }
              aria-pressed={swimType === swim}
            >
              <span aria-hidden>{swim === "SCHOOL" ? "≋" : swim === "GLIDE" ? "⟶" : swim === "WAVE" ? "〰" : "⠿"}</span>
              {swim}
            </button>
          ))}
        </div>
        <p className="shortcut-note">0 SCENE · 1–3 MODE · D DIVE · B BLACKOUT · F OUTPUT</p>
      </aside>

      <section className="output-column">
        <div
          className={`live-output ${dive ? "is-diving" : ""} ${isFullscreen ? "is-fullscreen" : ""}`}
          ref={outputRef}
        >
          <FishCanvas audio={audioLevels} onFps={setFps} />
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
      </section>

      <aside className="control-panel panel" aria-label="Live controls">
        <section className="scene-section">
          <h2>SCENE</h2>
          <div className="scene-buttons" role="group" aria-label="Scene mode">
            {SCENES.map((item) => (
              <button
                key={item.id}
                className={scene === item.id ? "is-active" : ""}
                onClick={() =>
                  dispatch({
                    v: 1,
                    producerId: "ui",
                    type: "scene",
                    payload: { update: "absolute", value: item.id },
                  })
                }
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
                onClick={() =>
                  dispatch({
                    v: 1,
                    producerId: "ui",
                    type: "mode",
                    payload: { update: "absolute", value: item },
                  })
                }
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
                onClick={() =>
                  dispatch({
                    v: 1,
                    producerId: "ui",
                    type: "macro",
                    payload: { update: "absolute", value: color },
                  })
                }
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
            onChange={(value) =>
              dispatchContinuous({ id: "colorDrive", update: "absolute", value })
            }
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
                  onClick={() =>
                    dispatch({
                      v: 1,
                      producerId: "ui",
                      type: "param",
                      payload: { id: "swarm", update: "absolute", value: item },
                    })
                  }
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
            onChange={(value) =>
              dispatchContinuous({ id: "fishCount", update: "absolute", value })
            }
          />
          <RangeControl
            label="FISH SIZE"
            value={fishSize}
            min={0.5}
            max={3}
            step={0.05}
            display={`${fishSize.toFixed(1)}x`}
            onChange={(value) =>
              dispatchContinuous({ id: "fishSize", update: "absolute", value })
            }
          />
          <RangeControl
            label="SPEED"
            value={speed}
            min={0.2}
            max={1.6}
            step={0.01}
            display={`${Math.round(speed * 100)}`}
            onChange={(value) =>
              dispatchContinuous({ id: "speed", update: "absolute", value })
            }
          />
          <RangeControl
            label="DEPTH"
            value={depth}
            min={0.15}
            max={1}
            step={0.01}
            display={`${Math.round(depth * 100)}`}
            onChange={(value) =>
              dispatchContinuous({ id: "depth", update: "absolute", value })
            }
          />
        </section>

        <div className="dive-controls">
          <button
            className={`dive-button ${dive ? "is-active" : ""}`}
            onClick={() =>
              dispatch({
                v: 1,
                producerId: "ui",
                type: "param",
                payload: { id: "dive", update: "absolute", value: true },
              })
            }
            aria-pressed={dive}
          >
            <b>{scene === "MANDALA" ? "∞" : "≋"}</b>
            <span>{scene === "MANDALA" ? "INFINITE DIVE" : "SCHOOL RUSH"}</span>
          </button>
          <button
            className="exit-button"
            onClick={() =>
              dispatch({
                v: 1,
                producerId: "ui",
                type: "param",
                payload: { id: "dive", update: "absolute", value: false },
              })
            }
            disabled={!dive}
          >
            {scene === "MANDALA" ? "EXIT DIVE" : "EXIT RUSH"}
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
            onClick={() =>
              dispatch({
                v: 1,
                producerId: "ui",
                type: "param",
                payload: { id: "blackout", update: "absolute", value: !blackout },
              })
            }
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
