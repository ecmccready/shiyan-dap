interface SystemState {
  step: number;
  observedValue: number;
  predictedValue: number;
  phi: number; // Internal coherence measure
}

export class MetamorphicEngine {
  /**
   * Plays dice with the system state. Forces a convergence checkpoint 
   * between what the founder knows (prediction) and what emerges (stochastic drift).
   */
  public static entangle(state: SystemState): { emergentState: SystemState; converged: boolean } {
    // 1. Generate the "Dice" factor - an unpredicted environmental mutation
    return MetamorphicEngine.entangleWithDrift(state, (Math.random() - 0.5) * 0.1);
  }

  /** Same step with the drift supplied by the caller (e.g. a seeded PRNG); pure and deterministic. */
  public static entangleWithDrift(state: SystemState, stochasticDrift: number): { emergentState: SystemState; converged: boolean } {
    
    // 2. Calculate the delta between prediction reference and raw observation
    const epistemicGap = Math.abs(state.predictedValue - state.observedValue);
    
    // 3. Mutate the observed value, simulating an unpredicted environmental shift
    const emergentObservation = state.observedValue + stochasticDrift * epistemicGap;
    
    // 4. Recalculate System Identity (Phi) stability under stress
    // Does the system maintain its operational identity .self() across the rift?
    const nextPhi = state.phi * (1.0 - Math.abs(stochasticDrift)) + (epistemicGap * 0.1);
    
    // 5. Evaluate Convergence: An emergent technology arises when the engine
    // normalizes the chaotic drift back into a safety-verified workflow bounding.
    const convergenceThreshold = 0.05;
    const isConverged = Math.abs(nextPhi - state.phi) < convergenceThreshold;

    return {
      emergentState: {
        step: state.step + 1,
        observedValue: emergentObservation,
        predictedValue: state.predictedValue, // The historic anchor stays rigid
        phi: parseFloat(nextPhi.toFixed(4))
      },
      converged: isConverged
    };
  }
}