// Replay playback + the shared session driver — FISHVJ_DESIGN_V2.md §4.1, §6.
//
// Record and replay run through the SAME driveSession() so determinism reduces
// to "does playback reconstruct the same events at the same source ticks". The
// driver applies each tick's events at that simulation tick, then advances; it
// samples the semantic hash every 30 ticks. Replay assigns a fresh bus `t`
// (sourceT is re-derived from the recorded source tick); the hash never sees `t`.
import { hashState, HASH_TICK_INTERVAL, type HashContext } from "../hash";
import { AUDIO_TICK_INTERVAL, TICK_MS } from "../types";
import type { EngineEvent, EngineEventInput, EngineStore } from "../types";
import { AUDIO_TRACK_ID, decodeChunks } from "./binary";
import {
  COLORS,
  CONTROL_TYPES,
  MODES,
  PARAMS,
  SCALE_MILLI,
  SCALE_NORM,
  SCENES,
  SWARMS,
  SWIMS,
  sourceTickOf,
  type ReplayManifest,
} from "./format";

export type HashEntry = { tick: number; hash: string };
export type ScheduledEvent = { sourceTick: number; input: EngineEventInput };

const HASH_VIEWPORT = { width: 1920, height: 1080 };

/**
 * Drives a store through a source-tick-indexed event schedule and returns the
 * 30-tick hash trace. Used identically for the record pass and the replay pass.
 * `onEvent` observes each canonical event (the recorder hooks in here).
 */
export function driveSession(
  store: EngineStore,
  eventsByTick: Map<number, EngineEventInput[]>,
  durationTicks: number,
  hashContext: HashContext,
  onEvent?: (event: EngineEvent) => void,
): HashEntry[] {
  const trace: HashEntry[] = [];
  const sample = () => {
    const state = store.getState();
    trace.push({
      tick: state.tick,
      hash: hashState(state, store.getRenderSnapshot(HASH_VIEWPORT), hashContext),
    });
  };

  for (let step = 0; step <= durationTicks; step += 1) {
    const inputs = eventsByTick.get(step);
    if (inputs) {
      for (const input of inputs) {
        // sourceT re-derives the source tick; the bus stamps a fresh t/seq.
        // NB: dispatch must run unconditionally — `onEvent?.(dispatch())` would
        // skip the dispatch entirely when onEvent is undefined (optional-call
        // short-circuits argument evaluation).
        const event = store.dispatch({ ...input, sourceT: step * TICK_MS });
        if (onEvent) onEvent(event);
      }
    }
    if (step % HASH_TICK_INTERVAL === 0) sample();
    if (step < durationTicks) store.advanceTick();
  }
  return trace;
}

function paramInput(code: number, values: number[]): EngineEventInput {
  const id = PARAMS[code];
  const base = { v: 1 as const, producerId: "replay" as const, type: "param" as const };
  switch (id) {
    case "colorDrive":
      return { ...base, payload: { id, update: "absolute", value: values[0] / SCALE_NORM } };
    case "fishCount":
      return { ...base, payload: { id, update: "absolute", value: values[0] } };
    case "fishSize":
    case "speed":
    case "depth":
      return { ...base, payload: { id, update: "absolute", value: values[0] / SCALE_MILLI } };
    case "dive":
    case "blackout":
      return { ...base, payload: { id, update: "absolute", value: values[0] === 1 } };
    case "swimType":
      return { ...base, payload: { id, update: "absolute", value: SWIMS[values[0]] } };
    case "swarm":
      return { ...base, payload: { id, update: "absolute", value: SWARMS[values[0]] } };
    case "fishSelection":
      return {
        ...base,
        payload: { id, update: "atomic", selectedSpecies: values[0], swimType: SWIMS[values[1]] },
      };
    default:
      throw new RangeError(`unknown param code ${code}`);
  }
}

function controlInput(typeIndex: number, payloadCode: number, values: number[]): EngineEventInput {
  const type = CONTROL_TYPES[typeIndex];
  const base = { v: 1 as const, producerId: "replay" as const };
  switch (type) {
    case "mode":
      return { ...base, type, payload: { update: "absolute", value: MODES[payloadCode] } };
    case "scene":
      return { ...base, type, payload: { update: "absolute", value: SCENES[payloadCode] } };
    case "macro":
      return { ...base, type, payload: { update: "absolute", value: COLORS[payloadCode] } };
    case "oneshot":
      return { ...base, type, payload: { id: "reset", update: "trigger" } };
    case "beat":
      return {
        ...base,
        type,
        payload: {
          kind: "clock",
          bpm: values[0] / SCALE_MILLI,
          phase: values[1] / SCALE_NORM,
          confidence: values[2] / SCALE_NORM,
          flux: values[3] / SCALE_NORM,
          energy: values[4] / SCALE_NORM,
        },
      };
    case "param":
      return paramInput(payloadCode, values);
    default:
      throw new RangeError(`replay cannot reconstruct control type ${type}`);
  }
}

/** Reconstructs the source-tick-indexed schedule from a recorded archive. */
export function parseArchive(archive: {
  manifest: ReplayManifest;
  control: string;
  audioBin: Uint8Array;
}): Map<number, EngineEventInput[]> {
  const eventsByTick = new Map<number, EngineEventInput[]>();
  const push = (tick: number, input: EngineEventInput) => {
    const list = eventsByTick.get(tick);
    if (list) list.push(input);
    else eventsByTick.set(tick, [input]);
  };

  // Audio band samples first, so a same-tick bands + control order matches record.
  for (const chunk of decodeChunks(archive.audioBin)) {
    if (chunk.trackId !== AUDIO_TRACK_ID) continue;
    const baseTick = sourceTickOf(chunk.startSourceT, 0);
    for (let j = 0; j < chunk.sampleCount; j += 1) {
      const tick = baseTick + j * AUDIO_TICK_INTERVAL;
      const o = j * 4;
      push(tick, {
        v: 1,
        producerId: "audio",
        type: "beat",
        payload: {
          kind: "bands",
          bands: [
            chunk.payload[o] / 255,
            chunk.payload[o + 1] / 255,
            chunk.payload[o + 2] / 255,
            chunk.payload[o + 3] / 255,
          ],
        },
      });
    }
  }

  const tuples: number[][] = JSON.parse(archive.control);
  let sourceTick = 0;
  for (const tuple of tuples) {
    // producerIndex (slot 1) is dropped: replay re-stamps every event as "replay".
    const [deltaSourceTick, , typeIndex, payloadCode, ...values] = tuple;
    sourceTick += deltaSourceTick;
    push(sourceTick, controlInput(typeIndex, payloadCode, values));
  }

  return eventsByTick;
}
