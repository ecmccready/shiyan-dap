/** state_predictor: baseline temporal predictors that drive event-driven updates. Pure. */
import type { StatePredictor } from "./types";

/** Last value (zero-order hold): predicts no change. */
export const lastValuePredictor: StatePredictor = {
  name: "last",
  predict(prev1: number): number { return prev1; },
};

/** Linear extrapolation from the last two held values (first-order hold); falls back to last value. */
export const linearPredictor: StatePredictor = {
  name: "linear",
  predict(prev1: number, prev2: number, framesSeen: number): number {
    return framesSeen >= 2 ? 2 * prev1 - prev2 : prev1;
  },
};

/** No temporal hold: the prediction is the (relational / low-rank) base alone. */
export const zeroPredictor: StatePredictor = {
  name: "zero",
  predict(): number { return 0; },
};

export function predictorByName(name: StatePredictor["name"]): StatePredictor {
  return name === "linear" ? linearPredictor : name === "zero" ? zeroPredictor : lastValuePredictor;
}
