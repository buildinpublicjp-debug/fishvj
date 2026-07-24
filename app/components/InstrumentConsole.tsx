"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { FixedStepClock } from "../engine/clock";
import { gainQ16FromRaw14 } from "../engine/instrument/eq";
import { encodeQ16 } from "../engine/instrument/fixed";
import { createInstrumentStore, type InstrumentSnapshot } from "../engine/instrument/store";
import type { DeckId } from "../engine/instrument/transport";
import { createCompositor, type Compositor, type OutputMode } from "./instrument-renderer";
import { loadedStackArg, STACKS } from "./instrument-fixtures";

const RAW_CENTER = 8192;
const RAW_MAX = 16383;

export function InstrumentConsole() {
  const store = useMemo(() => createInstrumentStore(138), []);
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const programRef = useRef<HTMLCanvasElement>(null);
  const monitorARef = useRef<HTMLCanvasElement>(null);
  const monitorBRef = useRef<HTMLCanvasElement>(null);
  const snapRef = useRef<InstrumentSnapshot>(snap);
  useEffect(() => {
    snapRef.current = snap;
  });
  const outputWinRef = useRef<Window | null>(null);
  const [outputOpen, setOutputOpen] = useState(false);

  // Load and play both decks on mount so the surface is alive on open (an empty
  // surface renders black, which reads as "nothing works").
  useEffect(() => {
    store.dispatch({ type: "deck", action: "load", deck: "A", ...loadedStackArg(STACKS[0]) });
    store.dispatch({ type: "deck", action: "load", deck: "B", ...loadedStackArg(STACKS[1]) });
    store.dispatch({ type: "transport", action: "playing", deck: "A", value: true });
    store.dispatch({ type: "transport", action: "playing", deck: "B", value: true });
    store.dispatch({ type: "deck", action: "crossfader", valueQ16: Math.round(0.5 * 65536) });
  }, [store]);

  // Fixed 60Hz simulation advance + render loop.
  useEffect(() => {
    const clock = new FixedStepClock();
    const programCanvas = programRef.current!;
    const monitorACanvas = monitorARef.current!;
    const monitorBCanvas = monitorBRef.current!;
    const program = createCompositor(programCanvas);
    const monitorA = createCompositor(monitorACanvas);
    const monitorB = createCompositor(monitorBCanvas);
    let outputComp: Compositor | null = null;
    let outputCanvas: HTMLCanvasElement | null = null;
    let raf = 0;
    const start = performance.now();

    const sizeTo = (comp: Compositor, canvas: HTMLCanvasElement) => {
      const r = canvas.getBoundingClientRect();
      const w = Math.max(2, Math.floor(r.width));
      const h = Math.max(2, Math.floor(r.height));
      if (canvas.width !== w || canvas.height !== h) comp.resize(w, h);
    };

    const frame = (now: number) => {
      clock.accumulate(now);
      for (let i = clock.takeTicks(5); i > 0; i -= 1) store.advanceTick();
      const s = store.getSnapshot();
      const t = (now - start) / 1000;
      sizeTo(program, programCanvas);
      program.render(s, "program", t);
      sizeTo(monitorA, monitorACanvas);
      monitorA.render(s, "previewA", t);
      sizeTo(monitorB, monitorBCanvas);
      monitorB.render(s, "previewB", t);
      if (outputComp && outputCanvas) {
        if (outputCanvas.isConnected) {
          outputCanvas.width = outputCanvas.clientWidth || 1920;
          outputCanvas.height = outputCanvas.clientHeight || 1080;
          outputComp.render(s, "program", t);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const win = outputWinRef.current;
    if (win && !win.closed) {
      outputCanvas = win.document.querySelector("canvas");
      if (outputCanvas) outputComp = createCompositor(outputCanvas);
    }

    return () => {
      cancelAnimationFrame(raf);
      program.dispose();
      monitorA.dispose();
      monitorB.dispose();
      outputComp?.dispose();
    };
  }, [store, outputOpen]);

  const openOutput = useCallback(() => {
    const win = window.open("", "fishvj-program", "width=1280,height=720");
    if (!win) return;
    win.document.title = "FISHVJ — PROGRAM";
    win.document.body.className = "output-window-body";
    win.document.body.style.margin = "0";
    win.document.body.style.background = "#000";
    const c = win.document.createElement("canvas");
    c.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;display:block";
    win.document.body.appendChild(c);
    outputWinRef.current = win;
    win.addEventListener("beforeunload", () => setOutputOpen(false));
    setOutputOpen(true);
  }, []);

  // --- gesture helpers ---
  const setGrammar = (value: "DJ" | "VJ") => store.dispatch({ type: "deck", action: "setGrammar", value });
  const load = (deck: DeckId, stackIndex: number) =>
    store.dispatch({ type: "deck", action: "load", deck, ...loadedStackArg(STACKS[stackIndex]) });
  const eject = (deck: DeckId) => store.dispatch({ type: "deck", action: "eject", deck });
  const playPause = (deck: DeckId) => {
    if (snap.controlGrammar === "VJ") {
      store.dispatch({ type: "deck", action: "selectPreview", deck });
      store.reservePreviewLaunch();
    } else {
      store.dispatch({ type: "transport", action: "playing", deck, value: !snap[deck].playing });
    }
  };
  const cue = (deck: DeckId) => store.dispatch({ type: "transport", action: "cue", deck });
  const setRate = (deck: DeckId, x: number) =>
    store.dispatch({ type: "transport", action: "rate", deck, valueQ16: encodeQ16(x) });
  const setOpacity = (deck: DeckId, v: number) =>
    store.dispatch({ type: "deck", action: "channelOpacity", deck, valueQ16: Math.round(v * 65536) });
  const setCross = (v: number) => store.dispatch({ type: "deck", action: "crossfader", valueQ16: Math.round(v * 65536) });
  const setEq = (deck: DeckId, band: "LOW" | "MID" | "HI", raw14: number) =>
    store.dispatch({ type: "eq", deck, band, gainQ16: gainQ16FromRaw14(raw14) });
  const hotCue = (deck: DeckId, index: number) =>
    store.dispatch({ type: "transport", action: "hotCue", deck, index, op: "trigger" });

  // Keyboard fallback (§5.3): no FLX4 required.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (k === "g") setGrammar(snapRef.current.controlGrammar === "DJ" ? "VJ" : "DJ");
      else if (k === "q") playPause("A");
      else if (k === "p") playPause("B");
      else if (k === "z") cue("A");
      else if (k === "m") cue("B");
      else if (k === "arrowleft") setCross(Math.max(0, snapRef.current.crossfader - 0.05));
      else if (k === "arrowright") setCross(Math.min(1, snapRef.current.crossfader + 0.05));
      else if (k >= "1" && k <= "8") hotCue("A", Number(k) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deckPct = (s: InstrumentSnapshot["A"]) => {
    const frames = 60; // approximate loop length for the bar; visual only
    return `${((s.framePosition % frames) / frames) * 100}%`;
  };

  return (
    <main className="inst-shell">
      <header className="inst-top">
        <div className="inst-brand">FISH<span>VJ</span> · INSTRUMENT</div>
        <div className="inst-badge">tick {snap.tick}</div>
        <div className="inst-badge">BPM {Math.round(snap.bpm)}</div>
        <div className="grow" />
        <div className="inst-grammar" role="group" aria-label="Control grammar">
          <button className={snap.controlGrammar === "DJ" ? "on" : ""} onClick={() => setGrammar("DJ")}>DJ</button>
          <button className={snap.controlGrammar === "VJ" ? "on" : ""} onClick={() => setGrammar("VJ")}>VJ</button>
        </div>
      </header>

      <div className="inst-main">
        <DeckStrip
          deck="A"
          snap={snap.A}
          deckPct={deckPct}
          load={load}
          eject={eject}
          playPause={playPause}
          cue={cue}
          setRate={setRate}
          hotCue={hotCue}
          grammar={snap.controlGrammar}
        />

        <section className="inst-outputs">
          <div className="output-stage">
            <span className="tag">PROGRAM · {snap.controlGrammar}</span>
            <canvas ref={programRef} />
            {snap.pendingLaunch && (
              <div className="launch-count">
                <b>{Math.ceil(snap.pendingLaunch.ticksRemaining / 60) || "•"}</b>
              </div>
            )}
          </div>
          <div className="preview-row">
            <div className="monitor deck-A-mon">
              <span className="tag">DECK A</span>
              <canvas ref={monitorARef} />
            </div>
            <div className="monitor deck-B-mon">
              <span className="tag">DECK B</span>
              <canvas ref={monitorBRef} />
            </div>
            <div className="inst-mixer">
              <div className="crossfader">
                <div className="ends">
                  <span className="deck-A-tint">A</span>
                  <span>CROSSFADER</span>
                  <span className="deck-B-tint">B</span>
                </div>
                <input type="range" min={0} max={1} step={0.001} value={snap.crossfader}
                  onChange={(e) => setCross(Number(e.target.value))} aria-label="Crossfader" />
              </div>
              <div className="ctl">
                <label><span>OPACITY A</span><span>{Math.round(snap.A.opacity * 100)}%</span></label>
                <input type="range" min={0} max={1} step={0.001} value={snap.A.opacity}
                  onChange={(e) => setOpacity("A", Number(e.target.value))} aria-label="Opacity A" />
                <label><span>OPACITY B</span><span>{Math.round(snap.B.opacity * 100)}%</span></label>
                <input type="range" min={0} max={1} step={0.001} value={snap.B.opacity}
                  onChange={(e) => setOpacity("B", Number(e.target.value))} aria-label="Opacity B" />
              </div>
            </div>
          </div>
        </section>

        <DeckStrip
          deck="B"
          snap={snap.B}
          deckPct={deckPct}
          load={load}
          eject={eject}
          playPause={playPause}
          cue={cue}
          setRate={setRate}
          hotCue={hotCue}
          grammar={snap.controlGrammar}
        />
      </div>

      <footer className="inst-transport">
        <button className="primary" onClick={openOutput}>{outputOpen ? "OUTPUT WINDOW OPEN" : "OPEN PROGRAM OUTPUT"}</button>
        <EqPanel deck="A" snap={snap.A} setEq={setEq} />
        <EqPanel deck="B" snap={snap.B} setEq={setEq} />
        <div className="grow" />
        <span className="hint">G grammar · Q/P play · Z/M cue · ←/→ crossfader · 1–8 hot cue A</span>
      </footer>
    </main>
  );
}

function DeckStrip({
  deck, snap, deckPct, load, eject, playPause, cue, setRate, hotCue, grammar,
}: {
  deck: DeckId;
  snap: InstrumentSnapshot["A"];
  deckPct: (s: InstrumentSnapshot["A"]) => string;
  load: (deck: DeckId, i: number) => void;
  eject: (deck: DeckId) => void;
  playPause: (deck: DeckId) => void;
  cue: (deck: DeckId) => void;
  setRate: (deck: DeckId, x: number) => void;
  hotCue: (deck: DeckId, i: number) => void;
  grammar: "DJ" | "VJ";
}) {
  return (
    <section className={`inst-deck deck-${deck}`}>
      <h2>DECK {deck}{snap.stackHash ? "" : " · empty"}</h2>
      <div className="deck-card">
        <div className="deck-load">
          {STACKS.map((s, i) => (
            <button key={s.id} onClick={() => load(deck, i)}>{s.name}</button>
          ))}
          <button className="deck-btn danger" onClick={() => eject(deck)}>EJECT</button>
        </div>
        <div className="playhead"><i style={{ width: deckPct(snap) }} /></div>
        <div className="deck-meta">
          <span>{snap.playing ? "▶ PLAY" : "❚❚ PAUSE"} · {snap.direction === "reverse" ? "◀" : "▶"}</span>
          <span>frame {snap.framePosition.toFixed(1)}</span>
        </div>
        <div className="deck-load">
          <button className={`deck-btn ${snap.playing ? "on" : ""}`} onClick={() => playPause(deck)}>
            {grammar === "VJ" ? "LAUNCH" : snap.playing ? "PAUSE" : "PLAY"}
          </button>
          <button className="deck-btn" onClick={() => cue(deck)}>CUE</button>
        </div>
        <div className="ctl">
          <label><span>RATE</span><span>{snap.rate.toFixed(2)}×</span></label>
          <input type="range" min={0.5} max={2} step={0.01} value={snap.rate}
            onChange={(e) => setRate(deck, Number(e.target.value))} aria-label={`Rate ${deck}`} />
        </div>
        <div className="hotcues">
          {Array.from({ length: 8 }, (_, i) => (
            <button key={i} onClick={() => hotCue(deck, i)}>{i + 1}</button>
          ))}
        </div>
      </div>
    </section>
  );
}

function EqPanel({
  deck, snap, setEq,
}: {
  deck: DeckId;
  snap: InstrumentSnapshot["A"];
  setEq: (deck: DeckId, band: "LOW" | "MID" | "HI", raw14: number) => void;
}) {
  const gainToRaw = (g: number) => (g <= 1 ? Math.round(g * RAW_CENTER) : Math.round(RAW_CENTER + (g - 1) * (RAW_MAX - RAW_CENTER)));
  return (
    <div className="eq-col" style={{ minWidth: 150 }}>
      <h3>EQ {deck}</h3>
      {(["LOW", "MID", "HI"] as const).map((band) => (
        <div className="ctl" key={band}>
          <label><span>{band}</span><span>{snap.eq[band].toFixed(2)}</span></label>
          <input type="range" min={0} max={RAW_MAX} step={1} value={gainToRaw(snap.eq[band])}
            onChange={(e) => setEq(deck, band, Number(e.target.value))} aria-label={`EQ ${deck} ${band}`} />
        </div>
      ))}
    </div>
  );
}
