import { engine } from "./store";
import type { EngineEventInput, EngineState, RenderSnapshot } from "./types";

/**
 * Deterministic capture bridge used by `capture/run-capture.mjs`.
 *
 * The bridge is installed only when the page is loaded with `?capture=1`.
 * Without that query flag nothing in this module runs, no global is defined and
 * the default render loop is untouched, so the frozen UI visual contract in
 * `docs/design/FISHVJ_UI_VISUAL_CONTRACT.md` is unaffected.
 */
const CAPTURE_QUERY = "capture";
const CAPTURE_GLOBAL = "__fishvjCapture";

export type CaptureHost = {
  /** True once the fish atlas texture has finished loading. */
  isReady(): boolean;
  getSize(): { width: number; height: number };
  /** Draws one frame with every audio band pinned to 0. */
  draw(): void;
};

export type CaptureSample = {
  tick: number;
  state: EngineState;
  snapshot: RenderSnapshot;
};

export function isCaptureEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get(CAPTURE_QUERY) === "1";
  } catch {
    return false;
  }
}

export function installCaptureBridge(host: CaptureHost) {
  const sample = (): CaptureSample => ({
    tick: engine.getState().tick,
    state: { ...engine.getState() },
    snapshot: { ...engine.getRenderSnapshot({ ...host.getSize() }) },
  });

  const bridge = {
    version: 1,
    isReady: () => host.isReady(),
    size: () => host.getSize(),
    sample,
    /**
     * Advances the engine to `targetTick`. Events stamped on tick N are
     * dispatched immediately before the `advanceTick()` that produces tick N.
     * Returns every sample whose tick is a multiple of `sampleEvery`.
     */
    runTo(
      targetTick: number,
      eventsByTick: Record<string, EngineEventInput[]>,
      sampleEvery: number,
    ) {
      const samples: CaptureSample[] = [];
      while (engine.getState().tick < targetTick) {
        const nextTick = engine.getState().tick + 1;
        const scheduled = eventsByTick[String(nextTick)];
        if (scheduled) {
          for (const input of scheduled) engine.dispatch(input);
        }
        engine.advanceTick();
        if (sampleEvery > 0 && nextTick % sampleEvery === 0) samples.push(sample());
      }
      return samples;
    },
    draw: () => host.draw(),
  };

  const scope = window as unknown as Record<string, unknown>;
  scope[CAPTURE_GLOBAL] = bridge;
  return () => {
    delete scope[CAPTURE_GLOBAL];
  };
}
