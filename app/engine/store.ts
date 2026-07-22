import { advanceEngineTick, createRenderSnapshot } from "./frame";
import { createInitialEngineState, reduceEvent } from "./reducer";
import type {
  EngineEvent,
  EngineEventInput,
  EngineState,
  EngineStore,
  FrameContext,
  RenderSnapshot,
} from "./types";
import { validateEngineEventInput } from "./validate";

type StoreOptions = {
  seed?: number;
  now?: () => number;
};

export function createEngineStore(options: StoreOptions = {}): EngineStore {
  let state: EngineState = createInitialEngineState(options.seed);
  let seq = 0;
  const listeners = new Set<() => void>();
  const now = options.now ?? (() => performance.now());

  const getState = () => state;
  const getRenderSnapshot = (context?: FrameContext) => createRenderSnapshot(state, context);

  return {
    dispatch(input: EngineEventInput) {
      validateEngineEventInput(input);
      const t = now();
      const event = {
        ...input,
        t,
        sourceT: input.sourceT ?? t,
        seq: seq++,
      } as EngineEvent;
      const nextState = reduceEvent(state, event);
      if (nextState !== state) {
        state = nextState;
        listeners.forEach((listener) => listener());
      }
      return event;
    },
    advanceTick(): RenderSnapshot {
      state = advanceEngineTick(state);
      return createRenderSnapshot(state);
    },
    getState,
    getRenderSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const engine = createEngineStore();
